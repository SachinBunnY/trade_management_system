## If you changed a file in your project (e.g., source code or config) and want to rebuild the container

docker-compose up -d --build <service_name>


## Let's say you changed a file in your Node.js app inside app/ folder and you're using Docker Compose:

docker-compose build app
docker-compose up -d app

## To clean up all the dangling images 
docker image prune

## To delete specific image by ID
docker rmi <image id>

## images listed with <none> for both REPOSITORY and TAG. These are called dangling images.
## They occur when you build a new version of an image that has the same repository and tag as an existing one. The older image is no longer referenced by a tag, becoming "dangling" but still consuming disk space.





# If slot got stuck then recreate it via below queries

SELECT * FROM pg_replication_slots WHERE slot_name='flask_cdc_slot';
SELECT pg_terminate_backend(active_pid) FROM pg_replication_slots WHERE slot_name='flask_cdc_slot';


SELECT pg_drop_replication_slot('flask_cdc_slot');
SELECT pg_create_logical_replication_slot('flask_cdc_slot', 'test_decoding');





