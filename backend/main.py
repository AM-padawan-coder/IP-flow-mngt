from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
import models  # noqa

Base.metadata.create_all(bind=engine)

app = FastAPI(title="IP Flow Manager", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "https://ip-flow-mngt.onrender.com"],
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import flows, topology
from routers import teams as teams_router
from routers import simulation as simulation_router
from routers import policies as policies_router
app.include_router(flows.router,            prefix="/flows",      tags=["Flux IP"])
app.include_router(topology.router,         prefix="/topology",   tags=["Topologie"])
app.include_router(teams_router.router,     prefix="/org",        tags=["Organisation"])
app.include_router(simulation_router.router,prefix="/simulation", tags=["Simulation"])
app.include_router(policies_router.router,  prefix="/policies",   tags=["Politiques réseau"])


@app.on_event("startup")
async def startup_event():
    from seed import seed_database
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


@app.get("/health", tags=["Système"])
def health():
    return {"status": "ok", "service": "IP Flow Manager", "version": "2.0.0"}
