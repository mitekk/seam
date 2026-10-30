create type hive_state as enum ('queenless', 'requeened', 'thriving');

create table apiaries (
  id    bigserial primary key,
  name  text not null unique
);

create table hives (
  id          bigserial primary key,
  apiary_id   bigint not null references apiaries(id),
  state       hive_state not null default 'queenless',
  inspected   timestamptz
);
