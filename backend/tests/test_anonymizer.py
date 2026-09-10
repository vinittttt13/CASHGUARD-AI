"""
Unit tests for PII and financial identifier anonymization in CASHGUARD-AI.
Tests cover Aadhaar, PAN, phone numbers, bank accounts, UPI IDs, IBANs, and crypto wallets.
"""

from app.utils.anonymizer import mask_text, mask_complaint_data


def test_mask_upi_id():
    text = "Payment received via upi_12345678 and upi_merchant998877"
    masked = mask_text(text)
    assert "***UPI***" in masked
    assert "upi_12345678" not in masked
    assert "upi_merchant998877" not in masked


def test_mask_iban():
    text = "Transfer to IBAN GB82WEST12345698765432 confirmed."
    masked = mask_text(text)
    assert "***IBAN***" in masked
    assert "GB82WEST12345698765432" not in masked


def test_mask_crypto_wallet():
    text = "Fraudulent funds sent to 0x71C66332C779Ea1990c8854876E762E4018789C1 on-chain."
    masked = mask_text(text)
    assert "***WALLET***" in masked
    assert "0x71C66332C779Ea1990c8854876E762E4018789C1" not in masked


def test_mask_pan_and_aadhaar():
    text = "Victim PAN is ABCDE1234F and Aadhaar is 1234 5678 9012."
    masked = mask_text(text)
    assert "ABCDE1234F" not in masked
    assert "1234 5678 9012" not in masked


def test_mask_phone_number():
    text = "Contact victim at +91 9876543210 or 9876543210 immediately."
    masked = mask_text(text)
    assert "9876543210" not in masked


def test_mask_complaint_data():
    raw_complaint = {
        "victim_name": "Ramesh Kumar",
        "victim_phone": "9876543210",
        "complaint_text": "Transferred money via upi_987654321 to unknown account.",
    }
    masked = mask_complaint_data(raw_complaint)
    assert "Ramesh" not in masked["victim_name_masked"]
    assert "9876543210" not in masked["victim_phone_masked"]
    assert "***UPI***" in masked["complaint_text_masked"]
