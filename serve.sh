#/!bin/sh

docker-compose -p epitech-search down
docker-compose -p epitech-search build
docker-compose -p epitech-search up -d
