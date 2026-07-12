from fastapi import FastAPI

app = FastAPI(title="Personal Web")

@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
