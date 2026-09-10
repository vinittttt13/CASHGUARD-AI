import logging
import re

from textblob import TextBlob

logger = logging.getLogger(__name__)


class NLPExtractor:
    def __init__(self):
        self.nlp = None
        self._nlp_unavailable = False
        self.banks = [
            'SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'BOB', 'Canara', 
            'Union Bank', 'Bank of India', 'IndusInd', 'Kotak', 'Yes Bank'
        ]
        self.urgency_keywords = ['urgent', 'threatening', 'blackmail', 'immediately', 'police', 'suicide', 'extortion']

    def load_model(self):
        """Load the spaCy pipeline if it is installed.

        The model is expected to be baked into the image
        (``python -m spacy download en_core_web_sm`` in the Dockerfile / CI).
        We never download at request time — if it is missing we fall back to a
        regex heuristic in ``extract_locations``.
        """
        if self.nlp is not None or self._nlp_unavailable:
            return
        try:
            import spacy

            self.nlp = spacy.load("en_core_web_sm")
        except Exception as exc:  # ImportError or OSError (model not installed)
            self._nlp_unavailable = True
            logger.warning(
                "spaCy en_core_web_sm unavailable (%s) — using regex location heuristic.",
                exc,
            )

    # Fallback: sequences of Capitalised words, minus obvious non-places.
    _LOC_RE = re.compile(r"\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b")
    _LOC_STOPWORDS = {
        "The", "A", "An", "I", "My", "He", "She", "They", "We", "It",
        "Rs", "Inr", "Sir", "Madam", "Bank", "Sbi", "Hdfc", "Icici",
    }

    def extract_locations(self, text):
        self.load_model()
        if self.nlp is not None:
            doc = self.nlp(text)
            return [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]
        # Regex heuristic
        out = []
        for m in self._LOC_RE.findall(text or ""):
            if m.split()[0] in self._LOC_STOPWORDS:
                continue
            out.append(m)
        return list(dict.fromkeys(out))

    def extract_banks(self, text):
        found = []
        text_lower = text.lower()
        for b in self.banks:
            if b.lower() in text_lower:
                found.append(b)
        return list(set(found))

    def extract_amounts(self, text):
        pattern = r'(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)'
        matches = re.findall(pattern, text.lower())
        amounts = []
        for m in matches:
            try:
                amounts.append(float(m.replace(',', '')))
            except:
                pass
        return amounts

    def get_sentiment_score(self, text):
        return TextBlob(text).sentiment.polarity

    def analyze_complaint(self, text):
        text_lower = text.lower()
        urgency = sum(1 for w in self.urgency_keywords if w in text_lower)
        urgency_score = min(1.0, urgency * 0.3)
        return {
            'locations': self.extract_locations(text),
            'banks': self.extract_banks(text),
            'amounts': self.extract_amounts(text),
            'sentiment_score': self.get_sentiment_score(text),
            'urgency_score': urgency_score
        }
