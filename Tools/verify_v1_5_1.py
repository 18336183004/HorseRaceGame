from __future__ import annotations

import json
import re
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def main() -> None:
    project = json.loads((ROOT / "Client/project.json").read_text(encoding="utf-8"))
    if project.get("engine") != "cocos-creator" or project.get("version") != "3.8.8":
        fail("Client/project.json is not pinned to Cocos Creator 3.8.8.")

    migration = (ROOT / "Database/DeployInit/004_add_game_domain_logs.sql").read_text(
        encoding="utf-8"
    )
    for table in ("race_logs", "horse_logs", "character_logs"):
        if not re.search(rf"CREATE TABLE IF NOT EXISTS {table}\b", migration):
            fail(f"Missing log table migration: {table}")

    application = (
        ROOT / "Server/RaceGame.Application/RaceGame.Application.csproj"
    ).read_text(encoding="utf-8")
    if "RaceGame.Infrastructure" in application:
        fail("Application must not reference Infrastructure.")

    infrastructure = (
        ROOT / "Server/RaceGame.Infrastructure/RaceGame.Infrastructure.csproj"
    ).read_text(encoding="utf-8")
    if "RaceGame.Application" not in infrastructure:
        fail("Infrastructure must implement the Application persistence boundary.")

    banned = (
        "string.GetHashCode(",
        "Console.WriteLine(",
        "playerId = 1",
        'clientVersion: "1.5.0"',
        "ApiClient.baseUrl",
    )
    for path in (ROOT / "Server").rglob("*.cs"):
        if any(part in path.parts for part in ("bin", "obj", ".vs")):
            continue
        text = path.read_text(encoding="utf-8")
        for item in banned:
            if item in text:
                fail(f"Banned pattern {item!r} found in {path.relative_to(ROOT)}")

    for path in (ROOT / "Client/assets/scripts").glob("*.ts"):
        text = path.read_text(encoding="utf-8")
        if re.search(r"\bany\b", text):
            # The project rule is about the TypeScript any type; comments may contain
            # the word naturally, so only flag common type-annotation forms here.
            if re.search(r":\s*any\b|<any>|as\s+any\b", text):
                fail(f"TypeScript any type found in {path.relative_to(ROOT)}")

    for path in ROOT.rglob("*.csproj"):
        if any(part in path.parts for part in ("bin", "obj", ".vs")):
            continue
        try:
            ET.parse(path)
        except ET.ParseError as exc:
            fail(f"Invalid csproj XML: {path.relative_to(ROOT)}: {exc}")

    print("VERIFY_V1.5.1 PASS")
    print("Cocos Creator 3.8.8 metadata: PASS")
    print("Application/Infrastructure dependency boundary: PASS")
    print("Race/Horse/Character log migration: PASS")
    print("Security and banned-pattern scan: PASS")
    print("C# project XML: PASS")


if __name__ == "__main__":
    main()
