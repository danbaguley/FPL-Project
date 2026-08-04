import asyncio

import httpx
import pandas as pd
from cache import Cache
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="FPL Analytics API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

cache = Cache(ttl_seconds=3600)
FPL_BASE = "https://fantasy.premierleague.com/api"
HEADERS = {"User-Agent": "Mozilla/5.0"}


async def fpl_get(client: httpx.AsyncClient, path: str) -> dict:
    response = await client.get(f"{FPL_BASE}{path}", headers=HEADERS, timeout=30.0)
    response.raise_for_status()
    return response.json()


@app.get("/api/bootstrap-static")
async def bootstrap_static():
    if data := cache.get("bootstrap-static"):
        return data
    async with httpx.AsyncClient() as client:
        data = await fpl_get(client, "/bootstrap-static/")
    cache.set("bootstrap-static", data)
    return data


@app.get("/api/fixtures")
async def get_fixtures():
    if data := cache.get("fixtures"):
        return data
    async with httpx.AsyncClient() as client:
        data = await fpl_get(client, "/fixtures/")
    cache.set("fixtures", data)
    return data


@app.get("/api/entry/{team_id}")
async def get_entry(team_id: int):
    async with httpx.AsyncClient() as client:
        try:
            return await fpl_get(client, f"/entry/{team_id}/")
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=404, detail="Team not found")


@app.get("/api/entry/{team_id}/event/{gw}/picks")
async def get_picks(team_id: int, gw: int):
    async with httpx.AsyncClient() as client:
        try:
            return await fpl_get(client, f"/entry/{team_id}/event/{gw}/picks/")
        except httpx.HTTPStatusError:
            raise HTTPException(status_code=404, detail="Picks not found")


@app.get("/api/players/form")
async def players_form():
    """
    Fetches last 5 GW stats for all players, processed with pandas.
    Result is cached for 1 hour to avoid re-fetching 700 individual player summaries.
    """
    if data := cache.get("players-form"):
        return data

    bootstrap = await bootstrap_static()
    player_ids = [p["id"] for p in bootstrap["elements"]]

    async def fetch_summary(client: httpx.AsyncClient, player_id: int):
        try:
            return player_id, await fpl_get(client, f"/element-summary/{player_id}/")
        except Exception:
            return player_id, {"history": []}

    summaries = {}
    BATCH = 100
    async with httpx.AsyncClient() as client:
        for i in range(0, len(player_ids), BATCH):
            batch = player_ids[i : i + BATCH]
            results = await asyncio.gather(*[fetch_summary(client, pid) for pid in batch])
            for pid, data in results:
                summaries[pid] = data

    def col_sum(df: pd.DataFrame, col: str, as_float: bool = False):
        if col not in df.columns:
            return 0.0 if as_float else 0
        series = pd.to_numeric(df[col], errors="coerce").fillna(0)
        return round(float(series.sum()), 2) if as_float else int(series.sum())

    form_stats = {}
    for pid, summary in summaries.items():
        history = summary.get("history", [])
        if not history:
            continue
        df = pd.DataFrame(history).tail(5)
        form_stats[str(pid)] = {
            "starts": col_sum(df, "starts"),
            "minutes": col_sum(df, "minutes"),
            "total_points": col_sum(df, "total_points"),
            "goals_scored": col_sum(df, "goals_scored"),
            "assists": col_sum(df, "assists"),
            "clean_sheets": col_sum(df, "clean_sheets"),
            "expected_goals": col_sum(df, "expected_goals", as_float=True),
            "expected_assists": col_sum(df, "expected_assists", as_float=True),
            "expected_goal_involvements": col_sum(df, "expected_goal_involvements", as_float=True),
            "defensive_contribution": col_sum(df, "defensive_contribution", as_float=True),
        }

    cache.set("players-form", form_stats, ttl_seconds=3600)
    return form_stats
