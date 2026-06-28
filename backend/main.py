from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base, SessionLocal
import models  # noqa

Base.metadata.create_all(bind=engine)

# SQLite column migrations (safe: try/except per column)
from sqlalchemy import text as _text
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE zones ADD COLUMN datacenter_id INTEGER REFERENCES physical_zones(id)",
        "ALTER TABLE equipment ADD COLUMN logical_zone_id INTEGER REFERENCES zones(id)",
    ]:
        try:
            _conn.execute(_text(_stmt)); _conn.commit()
        except Exception:
            pass

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
from routers import overlay as overlay_router
from routers import backup as backup_router
from routers import compliance as compliance_router
from routers import applications as applications_router
from routers import environments as environments_router
app.include_router(flows.router,               prefix="/flows",        tags=["Flux IP"])
app.include_router(topology.router,            prefix="/topology",     tags=["Topologie"])
app.include_router(teams_router.router,        prefix="/org",          tags=["Organisation"])
app.include_router(simulation_router.router,   prefix="/simulation",   tags=["Simulation"])
app.include_router(policies_router.router,     prefix="/policies",     tags=["Politiques réseau"])
app.include_router(overlay_router.router,      prefix="/overlay",      tags=["Overlays"])
app.include_router(backup_router.router,       prefix="/backups",      tags=["Sauvegardes"])
app.include_router(compliance_router.router,   prefix="/compliance",   tags=["Conformité"])
app.include_router(applications_router.router, prefix="/applications", tags=["Applications"])
app.include_router(environments_router.router, prefix="/environments", tags=["Environnements"])


def _run_migrations():
    from sqlalchemy import text
    with engine.connect() as conn:
        for table, col, typ in [
            ("flow_requests", "criticality",   "VARCHAR"),
            ("flow_requests", "sla",           "VARCHAR"),
            ("flow_requests", "bandwidth_max", "FLOAT"),
            ("flow_requests", "vrf_name",        "VARCHAR"),
            ("flow_requests", "rejection_reason", "VARCHAR"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
                conn.commit()
            except Exception:
                pass


@app.on_event("startup")
async def startup_event():
    _run_migrations()
    from seed import seed_database, seed_demo_routes, seed_default_environments
    db = SessionLocal()
    try:
        seed_database(db)
        seed_demo_routes(db)
        seed_default_environments(db)
    finally:
        db.close()
    # Start backup scheduler as background asyncio task
    from routers.backup import backup_scheduler_loop
    import asyncio
    asyncio.create_task(backup_scheduler_loop())


@app.get("/health", tags=["Système"])
def health():
    return {"status": "ok", "service": "IP Flow Manager", "version": "2.0.0"}
