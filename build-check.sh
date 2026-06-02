#!/bin/bash

# this scripts make sure that the build is only allowed to run on the staging or main branch

echo "VERCEL_GIT_COMMIT_REF: $VERCEL_GIT_COMMIT_REF"

if [[ "$VERCEL_GIT_COMMIT_REF" == "staging" || "$VERCEL_GIT_COMMIT_REF" == "main" ]] ; then
  # Proceed with the build
  echo "✅ - Build can proceed"
  exit 1;
else
  # Don't build
  echo "🛑 - Build cancelled"
  exit 0;
fi