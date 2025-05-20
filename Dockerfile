# Stage 1: Build the application
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

# Set environment to production by default, can be overridden
ENV NODE_ENV=production

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./
# COPY yarn.lock ./ # Uncomment if you use Yarn

# Install dependencies using npm ci for cleaner installs, or npm install
# npm ci is generally recommended for CI/CD as it uses package-lock.json strictly
RUN npm ci
# RUN yarn install --frozen-lockfile # Uncomment if you use Yarn

# Copy the rest of the application source code
COPY . .

# Build the application
# The "build" script should be defined in your package.json (e.g., "nest build")
RUN npm run build
# RUN yarn build # Uncomment if you use Yarn

# Prune development dependencies (optional, but good practice if build doesn't do it)
# RUN npm prune --production # Be cautious if your build step needs devDeps

# Stage 2: Create the production image
FROM node:18-alpine
WORKDIR /usr/src/app

# Set environment to production
ENV NODE_ENV=production

# Copy only necessary files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./
# COPY --from=builder /usr/src/app/yarn.lock ./ # Uncomment if you use Yarn
COPY --from=builder /usr/src/app/dist ./dist

# Expose the port the app runs on (defined by PORT env var, default 3000)
# This will be the port your NestJS app listens on (e.g., app.listen(process.env.PORT || 3000))
EXPOSE ${PORT:-3000}

# Command to run the application
# This assumes your main entrypoint after build is 'dist/main.js'
CMD ["node", "dist/main.js"]
