#/!bin/sh

docker-compose -f docker-compose.test.yml -p epitech-search build
docker-compose -f docker-compose.test.yml -p epitech-search run --rm node
