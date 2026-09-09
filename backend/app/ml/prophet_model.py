import pandas as pd
from prophet import Prophet
import joblib
import json
from prophet.serialize import model_to_json, model_from_json

class TemporalForecaster:
    def __init__(self):
        self.model = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=True)
        self.model.add_country_holidays(country_name='IN')

    def train(self, historical_df):
        self.model.fit(historical_df)

    def forecast(self, periods=7):
        future = self.model.make_future_dataframe(periods=periods, freq='D')
        forecast_df = self.model.predict(future)
        return forecast_df[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]

    def forecast_by_hour(self, date):
        date_str = pd.to_datetime(date).strftime('%Y-%m-%d')
        hours = pd.date_range(start=date_str, periods=24, freq='H')
        future = pd.DataFrame({'ds': hours})
        forecast_df = self.model.predict(future)
        return forecast_df[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]

    def get_trend_components(self):
        return {
            'yearly': self.model.yearly_seasonality,
            'weekly': self.model.weekly_seasonality,
            'daily': self.model.daily_seasonality
        }

    def save(self, path):
        with open(path, 'w') as fout:
            json.dump(model_to_json(self.model), fout)

    def load(self, path):
        with open(path, 'r') as fin:
            self.model = model_from_json(json.load(fin))
