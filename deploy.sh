#!/bin/bash
# Automation script for Build and Deployment

GREEN='\033[0;32m'
RED='\033[031m'
NC='\033[0m'

echo -e "${GREEN}Starting Deployment Process...${NC}"

# 1. Login check - This fixes the 401 Unauthorized error
echo -e "${GREEN}Checking Firebase Authentication...${NC}"
firebase login

# 2. Build the project
echo -e "${GREEN}Running Build (npm run build)...${NC}"
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Build successful! Proceeding to deploy...${NC}"
    # 3. Deploy to Firebase
    firebase deploy --only hosting
else
    echo -e "${RED}Build failed. Please check the errors above before deploying.${NC}"
    exit 1
fi

echo -e "${GREEN}Deployment Complete!${NC}"
