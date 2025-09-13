# Supabase Configuration for Production Performance

## The Problem
The application is experiencing severe performance degradation when deployed, specifically when fetching user profiles. This is causing timeouts and continuous refresh loops. The root cause is that the database connection is not optimized for a production environment.

## The Solution
To fix this, we need to configure the Supabase project to use a high-performance connection pooler. This is a standard practice for production-grade applications and ensures that database connections are fast and reliable.

## Step-by-Step Instructions

1.  **Go to your Supabase Project Dashboard.**
2.  Navigate to **Project Settings**.
3.  In the sidebar, click on **Database**.
4.  Scroll down to the **Connection Pooling** section.
5.  You will see a connection string. It will look something like this:
    `postgres://postgres.[your-project-ref]:[your-password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`
6.  **Copy this entire connection string.**
7.  Now, go back to your **Project Settings** and click on **General**.
8.  Scroll down to the **Environment Variables** section.
9.  You need to find the variable named `DATABASE_URL` (or a similar name that your application uses to connect to the database).
10. **Replace the value of this variable with the new connection string you just copied.**
11. **Save the changes and redeploy your application.**

By making this change, you are telling your application to connect to the database through the high-performance pooler, which will resolve the timeout issues.

## Verification
After you have redeployed, the application should load instantly. The "Fetching profile..." step will complete in milliseconds, and the continuous refresh loop will be gone.
