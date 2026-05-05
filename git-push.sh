#!/bin/bash
# Enhanced script to push your project to a Git repository.

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Checking Git status...${NC}"

# Check if .git directory exists
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git branch -M main
fi

# Create a standard .gitignore if missing
if [ ! -f ".gitignore" ]; then
    echo "Creating .gitignore..."
    cat <<EOF > .gitignore
node_modules
.next
out
build
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.DS_Store
*.pem
EOF
fi

# Add all changes
echo -e "${GREEN}Staging all files...${NC}"
git add .

# Ask for commit message
echo "Enter commit message (press Enter for default 'Update project'):"
read message
if [ -z "$message" ]; then
    message="Update project: $(date +'%Y-%m-%d %H:%M:%S')"
fi

# Commit
echo -e "${GREEN}Committing changes...${NC}"
git commit -m "$message"

# Ask for remote URL if not set
if ! git remote | grep -q "origin"; then
    echo -e "${GREEN}Linking to remote...${NC}"
    echo "Enter your remote repository URL (e.g., https://github.com/username/repo.git):"
    read url
    if [ ! -z "$url" ]; then
        git remote add origin "$url"
        echo "Remote origin added."
    else
        echo "No remote URL provided. Skipping push."
        exit 0
    fi
fi

# Push to main
echo -e "${GREEN}Pushing to remote origin main...${NC}"
git push -u origin main

echo -e "${GREEN}Done! Your project is now on Git.${NC}"
