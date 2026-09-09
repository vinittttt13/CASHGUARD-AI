import spacy
from textblob import TextBlob
import re

class NLPExtractor:
    def __init__(self):
        self.nlp = None
        self.banks = [
            'SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'BOB', 'Canara', 
            'Union Bank', 'Bank of India', 'IndusInd', 'Kotak', 'Yes Bank'
        ]
        self.urgency_keywords = ['urgent', 'threatening', 'blackmail', 'immediately', 'police', 'suicide', 'extortion']

    def load_model(self):
        try:
            self.nlp = spacy.load('en_core_web_sm')
        except OSError:
            import spacy.cli
            spacy.cli.download('en_core_web_sm')
            self.nlp = spacy.load('en_core_web_sm')

    def extract_locations(self, text):
        if not self.nlp:
            self.load_model()
        doc = self.nlp(text)
        return [ent.text for ent in doc.ents if ent.label_ in ['GPE', 'LOC']]

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
