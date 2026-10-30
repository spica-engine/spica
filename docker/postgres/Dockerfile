ARG POSTGRES_MAJOR=18
FROM postgres:${POSTGRES_MAJOR}
ARG POSTGRES_MAJOR

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-${POSTGRES_MAJOR}-cron \
  && rm -rf /var/lib/apt/lists/*

COPY 00-pg-cron.sql /docker-entrypoint-initdb.d/00-pg-cron.sql

CMD ["postgres", "-c", "shared_preload_libraries=pg_cron", "-c", "cron.use_background_workers=on"]
