# fun_blog_cdn

## Manager CLI

Install the dependencies and link the command once:

```powershell
npm install
npm link
```

Run the manager from the project directory:

```powershell
manager
```

Choose `1` to generate a draft or `2` to publish an existing draft. Publishing uses the GitHub settings in `.env`; keep that file local and rotate any token that has been committed.
