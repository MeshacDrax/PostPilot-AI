# Database

MySQL is the persistence layer. The Prisma schema is the source of truth at [`../backend/prisma/schema.prisma`](../backend/prisma/schema.prisma), and deployable MySQL migrations are kept in [`../backend/prisma/migrations`](../backend/prisma/migrations). Use the migration and seed commands in the repository [README](../README.md); do not maintain a separate hand-edited SQL schema here.
