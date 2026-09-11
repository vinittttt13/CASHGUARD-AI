import re
from typing import Any, Dict


def mask_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 4:
        return "*" * (len(digits) - 4) + digits[-4:]
    return "*" * len(digits)


def mask_name(name: str) -> str:
    if not name:
        return ""
    parts = name.split()
    masked_parts = []
    for part in parts:
        if len(part) > 1:
            masked_parts.append(part[0] + "*" * (len(part) - 1))
        else:
            masked_parts.append(part)
    return " ".join(masked_parts)


def mask_account(account: str) -> str:
    if not account:
        return ""
    if len(account) >= 4:
        return "*" * (len(account) - 4) + account[-4:]
    return "*" * len(account)


def mask_text(text: str) -> str:
    """Mask PII entities (email, card, aadhaar, PAN, bank account, phone) within arbitrary free-form text."""
    if not text:
        return ""

    # 1. Emails: keep first character and domain
    def _mask_email(m):
        email = m.group(0)
        parts = email.split("@")
        user, domain = parts[0], parts[1]
        masked_user = user[0] + "***" if len(user) > 1 else "***"
        return f"{masked_user}@{domain}"

    text = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b", _mask_email, text
    )

    # 2. Credit/Debit Cards (16 digits separated by space or hyphen)
    text = re.sub(r"\b(?:\d{4}[-\s]){3}(\d{4})\b", r"****-****-****-\1", text)

    # 3. Aadhaar Number (12 digits with spaces or hyphens, e.g. 1234 5678 9012)
    text = re.sub(r"\b\d{4}[-\s]\d{4}[-\s](\d{4})\b", r"XXXX-XXXX-\1", text)

    # 4. PAN Card (5 uppercase letters, 4 digits, 1 uppercase letter)
    def _mask_pan(m):
        pan = m.group(0)
        return "*****" + pan[5:]

    text = re.sub(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", _mask_pan, text)

    # 5. UPI IDs
    text = re.sub(r"\bupi_[A-Za-z0-9]{6,}\b", "***UPI***", text)

    # 6. IBAN
    text = re.sub(
        r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b", "***IBAN***", text
    )

    # 7. Wallet addresses
    text = re.sub(r"\b0x[a-fA-F0-9]{40}\b", "***WALLET***", text)

    # 5. Bank Account with prefix (e.g., A/C: 123456789012)
    def _mask_acct_match(m):
        full = m.group(0)
        num = m.group(1)
        masked_num = "*" * (len(num) - 4) + num[-4:]
        return full.replace(num, masked_num)

    text = re.sub(
        r"(?i)\b(?:a/c|acct|account|acc)[\s#.:no]*([0-9]{9,18})\b",
        _mask_acct_match,
        text,
    )

    # 6. Indian Mobile Phone Numbers (+91 or standalone 10 digits starting with 6-9)
    def _mask_phone_match(m):
        p = m.group(0)
        digits = re.sub(r"\D", "", p)
        if len(digits) >= 10:
            return "*" * (len(digits) - 4) + digits[-4:]
        return p

    text = re.sub(r"(?:\+91[\s-]?)?[6-9]\d{9}\b", _mask_phone_match, text)

    return text


def mask_complaint_data(complaint_dict: Dict[str, Any]) -> Dict[str, Any]:
    masked_data = complaint_dict.copy()

    if "victim_phone" in masked_data:
        masked_data["victim_phone_masked"] = mask_phone(masked_data.pop("victim_phone"))

    if "victim_name" in masked_data:
        masked_data["victim_name_masked"] = mask_name(masked_data.pop("victim_name"))

    if "account_number" in masked_data:
        masked_data["account_number_masked"] = mask_account(
            masked_data.pop("account_number")
        )

    if "complaint_text" in masked_data and isinstance(
        masked_data["complaint_text"], str
    ):
        masked_data["complaint_text_masked"] = mask_text(
            masked_data.pop("complaint_text")
        )

    if "description" in masked_data and isinstance(masked_data["description"], str):
        masked_data["description_masked"] = mask_text(masked_data.pop("description"))

    return masked_data
