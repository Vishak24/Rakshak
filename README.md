<h1 align="center">Rakshak</h1>

<p align="center">
  <strong>AI-Powered Safety Intelligence for Proactive Risk Awareness in India</strong>
</p>

<p align="center">
  Privacy-First • Advisory-Only • Cloud-Native • Responsible AI
</p>

<p align="center">
  <img src="https://img.shields.io/badge/AWS-Cloud%20Native-orange?style=for-the-badge&logo=amazonaws" />
  <img src="https://img.shields.io/badge/AI-Spatio--Temporal%20Analysis-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Architecture-Serverless-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

---

## 🌍 Overview

Rakshak is an AI-powered, privacy-first safety intelligence platform designed to support safer urban navigation across India.

It transforms **anonymized SOS signals** into **area-level, advisory risk awareness** using spatio-temporal pattern analysis on AWS.

Unlike traditional systems that react only after harm begins, Rakshak focuses on **early risk awareness** — enabling individuals to make informed decisions before situations escalate.

Rakshak does **not** replace emergency services or law enforcement.  
It provides a **decision-support layer** between:

> “Nothing is happening”  
> and  
> “Something has already gone wrong.”

---

## 🇮🇳 Why Bharat Needs This

India’s urban context presents unique safety challenges:

- Dense and rapidly growing cities  
- High mobility and transit zones  
- Underreporting of safety incidents  
- Infrastructure variability across neighborhoods  
- Cultural hesitation around escalation  

Today, individuals often lack contextual, data-driven awareness of emerging safety risks.

Rakshak fills this gap by converting **collective weak signals** into **proactive safety intelligence**.

---

## 💡 Core Insight

> Individual SOS events are weak signals.  
> Aggregated SOS patterns are powerful intelligence.

A single distress signal provides limited context.

But when anonymized signals are analyzed across:
- Time  
- Geography  
- Density  
- Recurrence  

They reveal emerging area-level safety patterns.

Rakshak treats SOS events not just as emergencies, but as **data points contributing to collective awareness**.

---

## ⚙️ How It Works (High-Level)

### 1️⃣ SOS Signal Generation
- User voluntarily triggers an SOS  
- Only reduced-precision location + timestamp captured  
- No personally identifiable information (PII)

### 2️⃣ Serverless Ingestion (AWS)
- Amazon API Gateway  
- AWS Lambda for processing  
- Immediate anonymization  
- Stored in Amazon DynamoDB with TTL enforcement  

### 3️⃣ AI Risk Engine
- Implemented using Amazon SageMaker  
- Spatio-temporal clustering & anomaly detection  
- Historical baseline comparison  
- Low / Medium / High area-level risk scoring  
- Confidence indicators included  

### 4️⃣ Risk Awareness Output
- Dynamic risk maps  
- Advisory signals (not commands)  
- Transparent uncertainty communication  

All final decisions remain with the user.

---

## 🏗 Architecture (Cloud-Native on AWS)

Rakshak is built as a scalable, serverless MVP aligned with India-scale deployment potential.

### Core AWS Services

- **Amazon API Gateway** – Secure endpoints  
- **AWS Lambda** – Event ingestion & orchestration  
- **Amazon SageMaker** – Pattern analysis & scoring  
- **Amazon DynamoDB** – Short-lived anonymized signal storage (TTL enforced)  
- **Amazon S3** – Aggregated historical pattern storage  

### Architecture Principles

- Serverless-first  
- Privacy-by-design  
- Auto-scaling  
- Cost-efficient MVP  
- Managed service reliability  

---

## 🔐 Privacy & Responsible AI

Privacy is foundational, not an afterthought.

### Data Minimization
- No user identity  
- No device tracking  
- No IP logging  
- No movement history  
- Area-level aggregation only  

### AI Safeguards
- No deterministic predictions  
- No individual risk scoring  
- No enforcement integration  
- Clear communication of uncertainty  

Rakshak intentionally avoids:
- Surveillance creep  
- Bias amplification  
- Over-policing  
- Area stigmatization  

---

## 📂 Repository Structure

| File | Description |
|------|------------|
| [`README.md`](./README.md) | Project overview |
| [`requirements.md`](./requirements.md) | Functional & non-functional requirements |
| [`design.md`](./design.md) | System architecture & technical design |
| [`LICENSE`](./LICENSE) | MIT License |

---

## 🚧 Scope & Limitations (MVP)

Rakshak is intentionally scoped.

### What It Does
- Provides probabilistic early risk awareness  
- Scales gradually with adoption  
- Supports informed decision-making  

### What It Does Not Claim
- Crime prediction  
- Guaranteed safety  
- Real-time incident prevention  
- Universal coverage  

Effectiveness improves with participation and signal density.

---

## 🎯 Impact Vision

Success for Rakshak is not perfect prediction.

Success is:
- Earlier awareness  
- Smarter navigation decisions  
- Reduced exposure to emerging risks  
- Incremental harm reduction  

Rakshak shifts the safety conversation from:

> “What do we do after something happens?”

to:

> “How do we help people see risk forming before it escalates?”

---

## 📜 License

This project is licensed under the MIT License.  
See the [`LICENSE`](./LICENSE) file for details.

---

<p align="center">
  <strong>Rakshak helps people see risk forming — before situations escalate.</strong>
</p>
