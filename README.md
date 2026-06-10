# Smart Asset Management and Resource Allocation Platform

## Project Overview
The Smart Asset Management Platform is a full-stack solution designed for the Cultural Council of IIT Roorkee (and similar organizations) to efficiently manage a shared pool of resources. This centralized system solves the problems of fragmented communication, scheduling conflicts, and resource underutilization by providing real-time inventory tracking, asset booking workflows, approval pipelines, and robust operational visibility. 

It handles complex edge cases like Peer-to-Peer (P2P) transfers, early asset returns, partial approvals, and maintains a strict, mathematically accurate, and highly visible chronological audit log.

## Technology Stack
- **Frontend**: React.js, Vite, TailwindCSS, Lucide Icons, Recharts (for Dashboard Analytics)
- **Backend**: Python, FastAPI, Motor (Async MongoDB Driver), Uvicorn
- **Database**: MongoDB (NoSQL)
- **Authentication**: JWT (JSON Web Tokens) with secure HTTP-only cookies and Bcrypt password hashing
- **Deployment**: Docker, Docker Compose

## Feature List

### Mandatory Features Implemented
- **User Authentication**: Secure JWT-based login/registration with Role-Based Access Control (Admin vs User).
- **Inventory Management**: Admins can add, edit, categorize, delete, and track real-time quantities of assets.
- **Asset Discovery and Booking**: Users can browse, search, and filter assets, and make booking requests for specific time ranges. The system mathematically prevents double-booking using dynamic availability checking.
- **Approval Workflow**: Admins can review, approve (fully or partially), or reject booking requests.
- **Asset Issue and Return Management**: Full lifecycle tracking. Assets can be formally issued and returned, with the system updating physical held quantities.
- **Analytics Dashboard**: Real-time charts showing utilization rates, top assets, and pending tasks.
- **Borrowing History**: Users can view their past requests, track active allocations, and see a chronological timeline of their booking.

### Bonus Features Implemented
- **Peer-to-Peer (P2P) Transfers**: Users can securely transfer active asset allocations to other users directly, with mandatory Admin approval. The system automatically splits the booking lineage and tracks the chain of custody.
- **Comprehensive Audit Logs**: Every action (booking, transfer, issue, return, inventory update) is tracked in a master system audit log with a highly detailed chronological timeline.
- **Notification System**: In-app unread notifications for approvals, rejections, P2P requests, and system alerts.

## Setup Instructions

### Prerequisites
- Node.js (v16+)
- Python 3.9+
- MongoDB instance (Local or Atlas)
- Docker (optional for containerized deployment)

### 1. Database Setup
Ensure MongoDB is running locally on port `27017` or update the `MONGODB_URL` in the backend environment file.

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create a `.env` file in the `backend/` directory:
```
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=smart_asset_management
JWT_SECRET=your_super_secret_key
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Create a `.env` file in the `frontend/` directory if you need to override the default API URL (defaults to `http://localhost:8000` via Vite proxy).

## Running the Application

### Running Locally (Development Mode)
1. **Start the Backend**:
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```
2. **Start the Frontend**:
```bash
cd frontend
npm run dev
```
3. Open your browser to `http://localhost:5173`.

### Running via Docker (Production Mode)
To run the entire stack using Docker Compose:
```bash
docker-compose up --build -d
```
The frontend will be available at port 80 and the backend API at port 8000.
