## Instructions

#Application (Xypr App)
- This is a middleware application that bridges between Genesys Contact Management Software and Whatsapp Business API. 
- It provides a web interface for agents to interact with customers via Whatsapp Business API. 
- Every Organization(tenant) will have multiple Agents under it. 
- An Organization(tenant) will have one Genesys account. Any agents loging in will come under the organization. 
 -An organization will have one WABA account through which all agents will interact with customers.
- Xyper app uses Open Messaging Protocol to connect with Genesys Contact Management Software.
- Xyper will be added as an Integration to Genesys Contact Management Software.
- Xyper app is a SAAS application.
# Users
1. Xyper Administrators : They are the ones who manage the Xyper app.
2. Genesys Users.
    2.1 Genesys Administrators
    2.2 Genesys Supervisors
    2.3 Genesys Agents
3. End Customers : They communicate via thier personal whatsapp account.