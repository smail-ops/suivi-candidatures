import os
import urllib.error
import urllib.request

import pytest

BASE_URL = os.environ.get(
    "APP_BASE_URL", "http://localhost:4173/suivi-candidatures/"
)

NB_PISTES_INITIALES = 4


@pytest.fixture(scope="session", autouse=True)
def verifier_serveur():
    try:
        urllib.request.urlopen(BASE_URL, timeout=5)
    except (urllib.error.URLError, OSError) as exc:
        pytest.exit(
            f"Application injoignable sur {BASE_URL} ({exc}).\n"
            "Lancez 'npm run build && npm run preview' avant pytest.",
            returncode=1,
        )


@pytest.fixture
def app(page):
    page.goto(BASE_URL)
    page.wait_for_selector("[data-testid='candidature-card']")
    return page


@pytest.fixture
def cartes(app):
    return app.get_by_test_id("candidature-card")
