import os
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from faker import Faker

fake = Faker('en_IN')

def generate_data(num_samples=5000):
    np.random.seed(42)
    random.seed(42)
    
    categories = ['Phishing', 'Identity Theft', 'Online Fraud', 'Ransomware', 'Cyberbullying']
    states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Rajasthan']
    cities = {
        'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
        'Delhi': ['New Delhi', 'Dwarka'],
        'Karnataka': ['Bangalore', 'Mysore'],
        'Tamil Nadu': ['Chennai', 'Coimbatore'],
        'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Noida'],
        'Rajasthan': ['Jaipur', 'Jodhpur']
    }
    
    banks = ['SBI', 'HDFC', 'ICICI', 'Axis', 'PNB', 'BOB', 'Canara']
    
    data = []
    
    # Generate ATMs
    atms = []
    for _ in range(200):
        lat = np.random.uniform(10.0, 30.0)
        lng = np.random.uniform(70.0, 90.0)
        atms.append({'atm_id': f"ATM_{random.randint(1000, 9999)}", 'lat': lat, 'lng': lng})
        
    atm_df = pd.DataFrame(atms)
    
    for i in range(num_samples):
        state = random.choice(states)
        district = random.choice(cities[state])
        amount = np.random.exponential(scale=50000)
        amount = np.clip(amount, 5000, 5000000)
        
        days_ago = random.randint(0, 365)
        # Weekdays more common
        hours = random.choices([10, 11, 12, 13, 18, 19, 20], weights=[2, 2, 2, 2, 1, 1, 1])[0]
        mins = random.randint(0, 59)
        dt = datetime.now() - timedelta(days=days_ago)
        dt = dt.replace(hour=hours, minute=mins)
        
        lat = np.random.uniform(18.0, 28.0)
        lng = np.random.uniform(72.0, 80.0)
        
        data.append({
            'complaint_id': f'CYB/2024/{10000+i}',
            'victim_name': fake.name(),
            'phone': fake.phone_number(),
            'category': random.choice(categories),
            'amount': amount,
            'state': state,
            'district': district,
            'lat': lat,
            'lng': lng,
            'timestamp': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'bank_name': random.choice(banks),
            'complaint_text': fake.text(max_nb_chars=200),
            'risk_level': random.choice(['low', 'medium', 'high', 'critical']),
            'cluster_id': random.randint(0, 10)
        })
        
    df = pd.DataFrame(data)
    
    out_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    os.makedirs(out_dir, exist_ok=True)
    
    df.to_csv(os.path.join(out_dir, 'complaints.csv'), index=False)
    atm_df.to_csv(os.path.join(out_dir, 'atm_locations.csv'), index=False)
    df.to_csv(os.path.join(out_dir, 'train_data.csv'), index=False)
    
    print(f"Generated {num_samples} records and saved to {out_dir}")

if __name__ == '__main__':
    generate_data()
