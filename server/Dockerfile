FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY cloud_agent.py .

ENV PORT=8080
ENV GCP_PROJECT=der-wegweiser
ENV GCP_REGION=europe-west3

EXPOSE 8080

CMD ["uvicorn", "cloud_agent:app", "--host", "0.0.0.0", "--port", "8080"]
