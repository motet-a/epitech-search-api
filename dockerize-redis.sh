c=epitech-search-redis
docker stop $c
docker rm $c
docker run --name $c -d redis

echo You can set the environment variable EPITECH_SEARCH_REDIS_HOST to
echo the following IP address:

docker inspect $c | \
    grep -i ipaddress | grep -v SecondaryIPAddresses | \
    head -n 1
