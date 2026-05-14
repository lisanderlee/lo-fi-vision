import json
import os

def calculate_comfort_index(temp, humidity):
    # Simplified Heat Index / Apparent Temperature
    # A basic formula: T + 0.5 * (e - 10)
    # where e is vapor pressure. For simplicity:
    # comfort = temp + (humidity / 100) * (temp - 70) if temp > 70
    if temp > 70:
        return round(temp + (humidity / 100.0) * (temp - 70), 1)
    return round(temp, 1)

def analyze_weather():
    input_path = 'src/data/weather_data.json'
    output_path = 'src/data/insights.json'
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    with open(input_path, 'r') as f:
        data = json.load(f)
    
    temp = data.get('temperature', 70)
    humidity = data.get('humidity', 50)
    seasonal_avg = 68.0 # Hardcoded seasonal average
    
    comfort_index = calculate_comfort_index(temp, humidity)
    
    diff = temp - seasonal_avg
    if diff > 5:
        anomaly = "unusually hot"
    elif diff < -5:
        anomaly = "unusually cold"
    else:
        anomaly = "normal"
        
    status = "Pleasant"
    if comfort_index > 85:
        status = "Extreme"
    elif comfort_index > 75:
        status = "Warm"
    elif comfort_index < 50:
        status = "Chilly"
        
    advice = f"Today is {anomaly} for this season. "
    if status == "Extreme":
        advice += "Stay hydrated and avoid prolonged sun exposure."
    elif status == "Pleasant":
        advice += "It's a perfect day for outdoor activities."
    elif status == "Warm":
        advice += "Keep light clothing and stay cool."
    else:
        advice += "Dress in layers to stay comfortable."
        
    insights = {
        "comfort_index": comfort_index,
        "status": status,
        "anomaly": anomaly,
        "advice": advice,
        "last_updated": data.get('last_updated', 'unknown')
    }
    
    with open(output_path, 'w') as f:
        json.dump(insights, f, indent=2)
    print(f"Insights exported to {output_path}")

if __name__ == "__main__":
    analyze_weather()
