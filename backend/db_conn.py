import psycopg2


database = 'postgres'
port = '5432'

tick_server_user = 'postgres'
tick_server_password = 'Server@Db@123'
tick_server_host = '192.168.29.85'


def getTickConnection(user=tick_server_user, password=tick_server_password, host=tick_server_host,):   
    conn  =  psycopg2.connect(dbname = database,
                              user = user,
                              password = password,
                              host = host,
                              port = port)
    return conn


def getCloudConnection():
    conn = psycopg2.connect(
        database="postgres",
        user="postgres",
        password="pass@123",
        host="192.168.29.89",
        port="5432",
    )
    return conn