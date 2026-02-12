<h1 align="center">Rakshak</h1>
<h3 align="center">AI-Powered Safety Intelligence for Proactive Risk Awareness in India</h3>

<hr/>

<h2>Overview</h2>

<p>
Rakshak is an AI-powered, privacy-first safety intelligence platform designed to support safer urban navigation across India.
The platform transforms anonymized SOS signals into <strong>area-level, advisory risk awareness</strong> using spatio-temporal pattern analysis on AWS.
</p>

<p>
Unlike traditional systems that react only after harm begins, Rakshak focuses on <strong>early risk awareness</strong> — enabling individuals to make informed decisions before situations escalate.
</p>

<ul>
<li><strong>Privacy-first</strong></li>
<li><strong>Advisory-only</strong></li>
<li><strong>Probabilistic, not deterministic</strong></li>
<li><strong>Designed for India’s dense and dynamic urban environments</strong></li>
</ul>

<p>
Rakshak does not replace emergency services, law enforcement, or institutional systems.
It acts as a <strong>decision-support layer</strong> between “nothing is happening” and “something has already gone wrong.”
</p>

<hr/>

<h2>The Bharat Context</h2>

<p>India presents unique safety and infrastructure challenges:</p>

<ul>
<li>Highly dense urban populations</li>
<li>Rapid mobility and transit zones</li>
<li>Underreporting of safety incidents</li>
<li>Cultural hesitation around escalation</li>
<li>Infrastructure variability across neighborhoods</li>
</ul>

<p>
Today, individuals navigating cities often lack contextual, data-driven awareness of emerging safety risks.
</p>

<p><strong>Questions many cannot answer:</strong></p>

<ul>
<li>Is this area generally safe at this time of day?</li>
<li>Are there recent emerging safety signals nearby?</li>
<li>Should I wait, reroute, or proceed?</li>
</ul>

<p>
Rakshak addresses this gap by transforming collective, anonymized SOS signals into proactive, community-level safety intelligence.
</p>

<hr/>

<h2>Core Insight</h2>

<blockquote>
<p><strong>Individual SOS events are weak signals.<br/>
Aggregated SOS patterns are powerful intelligence.</strong></p>
</blockquote>

<p>
When anonymized SOS signals are analyzed across time, geography, density, and recurrence patterns,
they reveal emerging safety trends at an area level.
</p>

<p>
Rakshak treats SOS events not only as emergencies, but as data points contributing to collective safety awareness.
</p>

<hr/>

<h2>How Rakshak Works (High-Level)</h2>

<h3>1. SOS Signal Generation</h3>
<ul>
<li>User voluntarily triggers an SOS</li>
<li>Only location (reduced precision) and timestamp are captured</li>
<li>No personally identifiable information (PII) is collected</li>
</ul>

<h3>2. Serverless Event Ingestion (AWS)</h3>
<ul>
<li>Signals received via Amazon API Gateway</li>
<li>Processed using AWS Lambda</li>
<li>Immediately anonymized</li>
<li>Stored temporarily in Amazon DynamoDB with TTL enforcement</li>
</ul>

<h3>3. AI Risk Engine</h3>
<ul>
<li>Implemented using Amazon SageMaker</li>
<li>Detects spatio-temporal clustering and anomaly patterns</li>
<li>Compares current activity against historical baselines</li>
<li>Generates Low / Medium / High area-level risk classifications</li>
<li>Includes confidence indicators to communicate uncertainty</li>
</ul>

<h3>4. Risk Awareness Output</h3>
<ul>
<li>Dynamic area-level risk maps</li>
<li>Advisory signals (not commands)</li>
<li>Transparent uncertainty communication</li>
</ul>

<p><strong>All final decisions remain with the user.</strong></p>

<hr/>

<h2>Architecture Summary (Cloud-Native on AWS)</h2>

<ul>
<li><strong>Amazon API Gateway</strong> – Secure API endpoints</li>
<li><strong>AWS Lambda</strong> – Event ingestion and orchestration</li>
<li><strong>Amazon SageMaker</strong> – Pattern analysis and risk scoring</li>
<li><strong>Amazon DynamoDB</strong> – Short-lived anonymized signals (TTL enforced)</li>
<li><strong>Amazon S3</strong> – Aggregated historical pattern storage</li>
</ul>

<p>
This architecture enables auto-scaling, cost-efficient MVP deployment, managed reliability, and India-scale expansion.
</p>

<hr/>

<h2>Privacy & Responsible AI</h2>

<ul>
<li>No collection of personally identifiable information</li>
<li>No user or device tracking</li>
<li>No movement history</li>
<li>Area-level aggregation only</li>
<li>Automatic data expiration</li>
<li>No deterministic predictions</li>
<li>No surveillance capabilities</li>
<li>Advisory-only outputs</li>
</ul>

<p>
Rakshak is intentionally designed to avoid surveillance creep, bias amplification, over-policing, and misuse.
</p>

<hr/>

<h2>Repository Contents</h2>

<ul>
<li><code>README.md</code> – Project overview</li>
<li><code>Requirements.md</code> – Functional and non-functional requirements</li>
<li><code>Design.md</code> – System architecture and technical design</li>
<li><code>LICENSE</code> – MIT License</li>
</ul>

<hr/>

<h2 align="center">Rakshak helps people see risk forming — before situations escalate.</h2>
