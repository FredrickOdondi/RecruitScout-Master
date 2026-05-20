# Stage 1: Build the React Dashboard
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the dashboard specifically
RUN npm run build:dashboard

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the dashboard output directory
# (vite.dashboard.config.ts roots in src/dashboard, so dist is there)
COPY --from=builder /app/src/dashboard/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
