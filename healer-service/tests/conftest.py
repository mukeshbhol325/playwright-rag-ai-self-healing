import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.container import Container, get_container
from app.main import create_app

# Trimmed OpenCart-like markup (checkout form + category listing + header).
OPENCART_DOM = """
<html><body>
<header>
  <a href="/en-gb?route=checkout/cart" title="Shopping Cart">Shopping Cart</a>
  <a href="/en-gb?route=checkout/checkout" title="Checkout">Checkout</a>
  <form id="search"><input type="text" name="search" placeholder="Search" class="form-control">
    <button type="submit" class="btn btn-light"><i class="fa-solid fa-magnifying-glass"></i></button></form>
</header>
<div id="product-list">
  <div class="product-thumb"><h4><a href="/iphone">iPhone</a></h4>
    <button type="submit" formaction="/index.php?route=checkout/cart.add" title="Add to Cart"><i class="fa"></i></button></div>
  <div class="product-thumb"><h4><a href="/htc">HTC Touch HD</a></h4>
    <button type="submit" formaction="/index.php?route=checkout/cart.add" title="Add to Cart"><i class="fa"></i></button></div>
</div>
<form id="form-register">
  <input type="text" name="firstname" id="input-firstname" placeholder="First Name" class="form-control">
  <input type="text" name="lastname" id="input-lastname" placeholder="Last Name" class="form-control">
  <input type="email" name="email" id="input-email" placeholder="E-Mail" class="form-control">
  <input type="text" name="address_1" id="input-shipping-address-1" placeholder="Address 1" class="form-control">
  <select name="country_id" id="input-shipping-country" class="form-select"><option>UK</option></select>
  <input type="hidden" name="token" id="input-token">
  <button type="submit" id="button-register" class="btn btn-primary">Continue</button>
</form>
<button id="button-confirm" class="btn btn-primary">Confirm Order</button>
</body></html>
"""


@pytest.fixture
def dom() -> str:
    return OPENCART_DOM


@pytest.fixture
def client(tmp_path):
    settings = Settings(kb_dir=str(tmp_path / "chroma"))
    container = Container(settings)
    app = create_app()
    app.dependency_overrides[get_container] = lambda: container
    return TestClient(app)
