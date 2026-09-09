import re
from typing import Dict, Any

def mask_phone(phone: str) -> str:
    if not phone:
        return ""
    # Remove non-digits
    digits = re.sub(r'\D', '', phone)
    if len(digits) >= 4:
        return '*' * (len(digits) - 4) + digits[-4:]
    return '*' * len(digits)

def mask_name(name: str) -> str:
    if not name:
        return ""
    parts = name.split()
    masked_parts = []
    for part in parts:
        if len(part) > 1:
            masked_parts.append(part[0] + '*' * (len(part) - 1))
        else:
            masked_parts.append(part)
    return " ".join(masked_parts)

def mask_account(account: str) -> str:
    if not account:
        return ""
    if len(account) >= 4:
        return '*' * (len(account) - 4) + account[-4:]
    return '*' * len(account)

def mask_complaint_data(complaint_dict: Dict[str, Any]) -> Dict[str, Any]:
    masked_data = complaint_dict.copy()
    
    if "victim_phone" in masked_data:
        masked_data["victim_phone_masked"] = mask_phone(masked_data.pop("victim_phone"))
        
    if "victim_name" in masked_data:
        masked_data["victim_name_masked"] = mask_name(masked_data.pop("victim_name"))
        
    if "account_number" in masked_data:
        masked_data["account_number_masked"] = mask_account(masked_data.pop("account_number"))
        
    return masked_data
