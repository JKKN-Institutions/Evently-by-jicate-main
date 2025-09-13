# Connecting Directly to Your Supabase Database for Maintenance

## Why is this necessary?
You have encountered errors like `VACUUM cannot run inside a transaction block`. This is because the Supabase SQL Editor runs all commands inside a "transaction" for safety. However, some essential maintenance commands are not allowed inside transactions.

To run them, you must connect to your database directly. This guide will show you how.

## Step-by-Step Instructions

### 1. Find Your Database Connection String

- Go to your Supabase Project dashboard.
- Navigate to **Project Settings** (the gear icon).
- In the sidebar, click on **Database**.
- Scroll down to the **Connection string** section.
- You will see a connection string that starts with `postgres://`. **Copy this string.** It contains your database password, so keep it safe.

### 2. Connect to Your Database using a Terminal

- Open a terminal or command prompt on your computer.
- You will use a command-line tool called `psql` to connect. If you don't have it, you may need to install the [PostgreSQL client tools](https://www.postgresql.org/download/).
- In your terminal, paste the connection string you copied, but make sure it is enclosed in quotes. It should look like this:

  ```bash
  psql "postgres://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres"
  ```
- Press Enter. If the connection is successful, your command prompt will change to `postgres=>`.

### 3. Run the Optimization Commands

- Now that you are connected directly to your database, you can run the maintenance commands.
- Copy and paste the following commands into the `psql` terminal one by one. Press Enter after each one.

  ```sql
  VACUUM (VERBOSE, ANALYZE) public.profiles;
  ```
  ```sql
  VACUUM (VERBOSE, ANALYZE) public.events;
  ```
  ```sql
  REINDEX TABLE public.profiles;
  ```
  ```sql
  REINDEX TABLE public.events;
  ```
- After running the commands, you can disconnect by typing `\q` and pressing Enter.

### 4. Redeploy Your Application

- With the database maintenance complete, the final step is to **redeploy your application** (e.g., on Vercel, Netlify, etc.).

## Verification
Your application should now load instantly. The timeout errors and login loops will be gone.
