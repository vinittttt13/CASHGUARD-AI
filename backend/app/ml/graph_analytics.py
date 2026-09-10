"""
Fraud Ring Graph Analytics — detects organized cybercrime syndicates and mule networks
by constructing entity co-occurrence graphs across complaints.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Set, Tuple

logger = logging.getLogger(__name__)


class FraudRingDetector:
    """Detects clusters of coordinated complaints sharing multiple entity attributes."""

    def __init__(self, min_ring_size: int = 3) -> None:
        self.min_ring_size = min_ring_size

    def build_entity_graph(
        self, complaints: List[Dict[str, Any]]
    ) -> Tuple[Dict[str, Set[str]], Dict[str, Dict[str, Any]]]:
        """Construct adjacency graph connecting complaints that share entities.

        Shared entities can include:
        - bank_name (e.g. "SBI")
        - district or city (e.g. "Mumbai")
        - victim_phone_masked / contact channel
        - account_number_masked (if present)
        """
        # Map entity -> set of complaint IDs
        entity_to_complaints: Dict[str, Set[str]] = defaultdict(set)
        complaint_metadata: Dict[str, Dict[str, Any]] = {}

        for c in complaints:
            cid = str(c.get("id", ""))
            if not cid:
                continue

            complaint_metadata[cid] = c

            bank = str(c.get("bank_name") or "").strip().lower()
            if bank and bank != "unknown":
                entity_to_complaints[f"bank:{bank}"].add(cid)

            loc = str(c.get("district") or c.get("city") or "").strip().lower()
            if loc and loc != "unknown":
                entity_to_complaints[f"loc:{loc}"].add(cid)

            phone = str(c.get("suspect_phone") or c.get("victim_phone_masked") or c.get("phone") or "").strip()
            if phone:
                entity_to_complaints[f"phone:{phone}"].add(cid)

            account = str(c.get("suspect_account") or c.get("account_number_masked") or c.get("account") or "").strip()
            if account:
                entity_to_complaints[f"account:{account}"].add(cid)

        # Build adjacency graph between complaints sharing at least 2 entities
        # or sharing 1 high-specificity entity (like phone or account)
        pair_shared_entities: Dict[Tuple[str, str], Set[str]] = defaultdict(set)

        for entity_key, cids in entity_to_complaints.items():
            cid_list = list(cids)
            for i in range(len(cid_list)):
                for j in range(i + 1, len(cid_list)):
                    pair = (min(cid_list[i], cid_list[j]), max(cid_list[i], cid_list[j]))
                    pair_shared_entities[pair].add(entity_key)

        adjacency: Dict[str, Set[str]] = defaultdict(set)
        for (c1, c2), shared in pair_shared_entities.items():
            # Edge condition: shared phone/account, or shared >= 2 attributes (e.g. same bank AND same district)
            has_high_spec = any(e.startswith("phone:") or e.startswith("account:") for e in shared)
            if has_high_spec or len(shared) >= 2:
                adjacency[c1].add(c2)
                adjacency[c2].add(c1)

        return adjacency, complaint_metadata

    def detect_rings(self, complaints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Find connected components representing organized fraud rings."""
        adjacency, metadata = self.build_entity_graph(complaints)

        visited: Set[str] = set()
        rings: List[Dict[str, Any]] = []

        all_cids = set(metadata.keys())

        ring_counter = 1
        for cid in all_cids:
            if cid in visited or cid not in adjacency:
                continue

            # BFS / DFS traversal
            component: List[str] = []
            queue = [cid]
            visited.add(cid)

            while queue:
                current = queue.pop(0)
                component.append(current)

                for neighbor in adjacency.get(current, set()):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        queue.append(neighbor)

            if len(component) >= self.min_ring_size:
                # Calculate ring aggregates
                member_complaints = [metadata[c] for c in component if c in metadata]
                total_amount = sum(
                    float(c.get("amount_lost") or c.get("amount_defrauded") or c.get("amount") or 0.0)
                    for c in member_complaints
                )

                banks = list({
                    str(c.get("bank_name"))
                    for c in member_complaints
                    if c.get("bank_name") and str(c.get("bank_name")).lower() != "unknown"
                })

                locations = list({
                    str(c.get("district") or c.get("city") or c.get("state"))
                    for c in member_complaints
                    if (c.get("district") or c.get("city") or c.get("state"))
                })

                suspect_identifiers = list({
                    str(ident)
                    for c in member_complaints
                    for ident in (c.get("suspect_phone"), c.get("suspect_account"), c.get("phone"), c.get("account"))
                    if ident
                })

                # Risk score based on syndicate size and financial impact
                size_factor = min(0.5, len(component) * 0.05)
                amount_factor = min(0.5, total_amount / 200000.0)
                risk_score = round(min(1.0, 0.4 + size_factor + amount_factor), 3)

                rings.append({
                    "ring_id": f"RING-{ring_counter:03d}",
                    "member_count": len(component),
                    "complaint_count": len(component),
                    "complaint_ids": component,
                    "suspect_identifiers": suspect_identifiers,
                    "shared_banks": banks,
                    "shared_locations": locations,
                    "total_defrauded_inr": round(total_amount, 2),
                    "total_amount_lost": round(total_amount, 2),
                    "risk_score": risk_score,
                    "confidence_score": risk_score,
                    "coordination_type": "SYNDICATE_RING",
                    "pattern": (
                        f"Organized syndicate targeting {', '.join(banks[:3]) if banks else 'multiple banks'} "
                        f"across {', '.join(locations[:3]) if locations else 'various regions'} "
                        f"with {len(component)} correlated complaints."
                    ),
                })
                ring_counter += 1

        rings.sort(key=lambda r: (r["risk_score"], r["member_count"]), reverse=True)
        return rings

