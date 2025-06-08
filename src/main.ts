import 'dotenv/config';
import { database } from '@/database';

if(!process.env.DATABASE_URL){
  throw new Error('DATABASE_URL is not set');
}

async function run(){
  let i:number = 5
  console.log('hello world', i);
  console.log(await database.bug.findMany());
}

run()