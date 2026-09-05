import os
import io
import base64
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://whs-safety-hub.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TEST_EMAIL = "safety@tk.com"
TEST_PASSWORD = "test1234"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_url():
    return API


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def auth_token(api_client):
    """Login using seeded test credentials; register if needed."""
    r = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
    if r.status_code == 200:
        return r.json()["token"]
    # register
    r = api_client.post(f"{API}/auth/register", json={
        "email": TEST_EMAIL, "password": TEST_PASSWORD, "name": "Safety Officer", "role": "Safety Officer"
    }, timeout=30)
    if r.status_code == 200:
        return r.json()["token"]
    if r.status_code == 409:
        r2 = api_client.post(f"{API}/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD}, timeout=30)
        assert r2.status_code == 200, f"login failed after 409: {r2.text}"
        return r2.json()["token"]
    pytest.skip(f"cannot obtain auth token: {r.status_code} {r.text}")


@pytest.fixture(scope="session")
def auth_headers(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def warehouse_image_b64():
    """Create a realistic JPEG with visible warehouse-like features (shapes, edges, text)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        pytest.skip("Pillow not installed")

    W, H = 800, 600
    img = Image.new("RGB", (W, H), (210, 210, 205))  # concrete floor
    d = ImageDraw.Draw(img)

    # ceiling with beams
    d.rectangle([0, 0, W, 120], fill=(180, 180, 190))
    for x in range(0, W, 100):
        d.line([(x, 0), (x, 120)], fill=(60, 60, 60), width=4)

    # warehouse racking (dark uprights + horizontal beams)
    for x in [80, 260, 440, 620]:
        d.rectangle([x, 120, x + 20, 500], fill=(90, 90, 100))
    for y in [200, 300, 400]:
        d.rectangle([80, y, 640, y + 12], fill=(120, 120, 130))

    # pallets/boxes on racks (brown boxes)
    for x in [110, 290, 470]:
        for y in [220, 320, 420]:
            d.rectangle([x, y - 60, x + 120, y - 10], fill=(160, 110, 60), outline=(80, 40, 10), width=2)
            d.line([(x, y - 60), (x + 120, y - 10)], fill=(80, 40, 10), width=1)

    # forklift silhouette
    d.rectangle([650, 380, 780, 470], fill=(230, 190, 30), outline=(0, 0, 0), width=3)  # body
    d.rectangle([660, 470, 690, 510], fill=(30, 30, 30))  # wheel
    d.rectangle([740, 470, 770, 510], fill=(30, 30, 30))  # wheel
    d.polygon([(650, 380), (600, 300), (610, 300), (655, 380)], fill=(230, 190, 30), outline=(0, 0, 0))  # mast
    d.line([(600, 320), (600, 500)], fill=(60, 60, 60), width=4)  # fork

    # worker figure (person)
    d.ellipse([350, 380, 380, 410], fill=(255, 210, 170))  # head
    d.rectangle([355, 410, 375, 470], fill=(240, 200, 30))  # hi-vis vest
    d.rectangle([355, 470, 365, 520], fill=(40, 40, 60))  # leg
    d.rectangle([365, 470, 375, 520], fill=(40, 40, 60))  # leg
    d.ellipse([348, 372, 382, 388], fill=(255, 240, 40))  # hard hat

    # exit sign
    d.rectangle([10, 130, 90, 160], fill=(200, 30, 30))
    try:
        font = ImageFont.load_default()
        d.text((25, 137), "EXIT", fill=(255, 255, 255), font=font)
        d.text((300, 550), "AISLE 3 - WAREHOUSE", fill=(20, 20, 20), font=font)
    except Exception:
        pass

    # floor markings
    d.line([(0, 520), (W, 520)], fill=(220, 200, 30), width=6)
    d.line([(0, 540), (W, 540)], fill=(220, 200, 30), width=6)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()
