# Microservices Online Shopping Capstone (GitOps + Prometheus & Grafana)

## Overview
- Microservices shopping application deployed via GitOps (ArgoCD) on local Minikube (2 CPUs, 3 GB RAM, Docker driver).
- Standalone Prometheus and Grafana Helm charts deployed in the monitoring namespace.

## Key Troubleshooting & Optimizations
- Switched from heavy kube-prometheus-stack to standalone Prometheus and Grafana charts to prevent OOMKilled and TLS handshake timeout on 3 GB RAM.
- Tuned/disabled health probes where startup took longer and scaled down non-essential ArgoCD controllers during resource crunch.
- Connected Grafana to http://prometheus-server.monitoring.svc.cluster.local and verified live up metrics.
