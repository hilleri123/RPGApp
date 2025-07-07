#!/bin/bash


curl -X 'POST' \
  'http://localhost:8000/auth/register' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "a@aa.ru",
  "full_name": "AAA",
  "password": "111111"
}'


curl -X 'POST' \
  'http://localhost:8000/auth/register' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "b@b.com",
  "full_name": "BBB",
  "password": "b"
}'


curl -X 'POST' \
  'http://localhost:8000/auth/register' \
  -H 'accept: application/json' \
  -H 'Content-Type: application/json' \
  -d '{
  "email": "user@example.com",
  "full_name": "string",
  "password": "string"
}'


