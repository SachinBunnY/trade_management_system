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




# --------------------------- SSH KEYS ------------------------------
vista-ai@vista-ai:~$ ssh-keygen -t ed25519 -C "github-actions"
Generating public/private ed25519 key pair.
Enter file in which to save the key (/home/vista-ai/.ssh/id_ed25519): 
Enter passphrase (empty for no passphrase): 
Enter same passphrase again: 
Your identification has been saved in /home/vista-ai/.ssh/id_ed25519
Your public key has been saved in /home/vista-ai/.ssh/id_ed25519.pub
The key fingerprint is:
SHA256:9XjFW7z5uR6r4oz0yI2bs4EZlve6nQvlc6bhArvnVdk github-actions
The key's randomart image is:
+--[ED25519 256]--+
|                 |
|             . . |
|          .   o o|
|        .. o .ooo|
|       +S...oo.E |
|      ..= +..   o|
|       oo+ * o o.|
|       .o+/.B   +|
|       .+%B@o.o+ |
+----[SHA256]-----+
