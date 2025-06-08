import { PrismaClient, Prisma } from '@prisma/client'
import { JsonArray, JsonObject, JsonValue, PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
// let modelnames = Prisma.dmmf.datamodel.models.map(m=>m.name); Value `in` modelnames

type NonNull<T> = Exclude<T, null | undefined>;

// type DataType<M extends keyof typeof prisma> = Prisma.Args<(typeof prisma)[M], 'create'>['data']

type ObjectWithArrays<T> = {
  [K in keyof T]: T[K] extends any[] ? { equals: T[K][number] } | T[K] : T[K];
};
function replaceArraysWithEquals<T>(obj: T): ObjectWithArrays<T> {
  const newObj: any = {};
  for (const key in obj) {
      if (Array.isArray(obj[key])) {
          const arr = obj[key] as any[];
          if (arr.length === 1) {
              newObj[key] = { equals: arr };
          } else {
              newObj[key] = arr.map((value: any) => ({ equals: value }));
          }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          newObj[key] = replaceArraysWithEquals(obj[key]);
      } else {
          newObj[key] = obj[key];
      }
  }
  return newObj as ObjectWithArrays<T>;
}

const prismaClientSingleton= ()=>{ 
  
  // let prisma = new PrismaClient({log:['error', 'query']});
  let prisma = new PrismaClient();
  return prisma.$extends({
    query:{
      $allOperations({ model, operation, args, query }) {
        /* your custom logic for modifying all Prisma Client operations here */
        return query(args)
      },
      // create({args, model, operation, query}){
      //   args.data.providerAccountId = args.data.providerAccountId.toString();
      //   console.log('HERE', typeof args.data.providerAccountId, args.data.providerAccountId);
      //   return query(args);
      // }
      account:{
        $allOperations({args, model, operation, query}){
          // console.log('HERE1', operation, typeof args?.data?.providerAccountId, args?.data?.providerAccountId);
          const transformFieldToString = (obj:Record<string, any>, field:string) => {
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const val = obj[key];
                    if (key === field) {
                        console.log('MATCH', val);
                        obj[key] = String(val);
                    } else if (typeof val === 'object') {
                        transformFieldToString(val, field);
                    }
                }
            }
            return obj;
        };
          transformFieldToString(args, 'providerAccountId');
          // console.log('HERE2', operation, typeof args?.data?.providerAccountId, args?.data?.providerAccountId);
          return query(args);
        }
      }
    },
    result:{
      // $allModels:{
      //   $toJson:{
      //     compute(data) {
      //       return ()=>{
      //         return data;
      //       }
      //     },
      //   }
      // }
    },
    // result: { //TODO nextjs not allowing symbols on functions?
    //   $allModels:{
    //     $save: {
    //       // needs: { id: true },
    //       compute(data:any) {
    //         "use server";
    //         return async () =>{
    //           "use server"; //have to mark these otherwise nextjs complains
    //           const ctx = Prisma.getExtensionContext(this) as any;
    //           // const ctx = prisma.client;
    //           return ctx.update({ where: { id: data.id }, data: data }) as Promise< void > //TODO, return typing: Promise< Prisma.Result<T, undefined, 'findFirstOrThrow'> >
    //         }
    //       },
    //     },
    //   }
    // },
    model: {
      $allModels:{
        async convertRawJson<T, A extends Prisma.Args<T, 'create'>>(
          this: T,
          rawJson: JsonObject,
        ){  //let t = await prisma.mindnightSession.create({  }); let q = prisma.mindnightSession.findFirst({})
          const ctx = Prisma.getExtensionContext<T>(this);
          function isObject(value:JsonValue):value is JsonObject {
            return typeof value === 'object' && !Array.isArray(value);
          }
          let obj = rawJson;
          for(let [key, value] of Object.entries(obj)){
            if(!value) continue;
            if(isObject(value) && value['$oid']) {
              if(key === '_id'){
                obj['id'] = value['$oid'];
                delete obj['_id'];
              }
              else
                obj[key] = value['$oid'];
            }
            else if(isObject(value) && value['$date']) obj[key] = new Date(value['$date'] as string) as unknown as JsonValue //we dont care for JSON typing anymore
            else if(isObject(value)) await (ctx as any).convertRawJson(value);
          }

          return obj as Awaited<Prisma.Result<T, A, 'create'>>;
        },
        async createOrFind<T, A extends Prisma.Args<T, 'create'>>(
          this: T,
          createArgs: A,
          queryArgs?: Prisma.Args<T, 'findFirst'>,
        ):Promise< { created:boolean, document:Awaited<Prisma.Result<T, A, 'create'>> } >{  //let t = await prisma.mindnightSession.create({  }); let q = prisma.mindnightSession.findFirst({})
          const ctx = Prisma.getExtensionContext<T>(this);
          let created = false;
          let document = queryArgs ? 
                        await (ctx as any).findFirst(queryArgs) : 
                        await (ctx as any).findFirst({where:replaceArraysWithEquals(createArgs.data), include:createArgs.include, select:createArgs.select });
          if(!document){
            document = await (ctx as any).create(createArgs);
            created=true;
          }
          return {created, document};
        },
        async createOrUpdate<T, A extends Prisma.Args<T, 'create'>>(
          this: T,
          createArgs: A,
          updateArgs?: Prisma.Args<T, 'update'>,
        ):Promise< { created:boolean, document:Awaited<Prisma.Result<T, A, 'create'>> } >{  //let t = await prisma.mindnightSession.create({  }); let q = prisma.mindnightSession.findFirst({})
          const ctx = Prisma.getExtensionContext<T>(this);
          let created = false;
          let document;
          try{
            document = updateArgs ? 
                          await (ctx as any).update(updateArgs) : 
                          await (ctx as any).update({where:replaceArraysWithEquals(createArgs.data), include:createArgs.include, select:createArgs.select });
          } catch(err){
            if (err instanceof PrismaClientKnownRequestError){
              // console.log('PrismaClientKnownRequestError ERROR');
              if(err.code !== 'P2025') //Not Found Error
                throw err;
              // console.log('Record to Update NOT FOUND', err.meta);
            }
            else
              throw err;
          }
          if(!document){ //if ( Record to Update NOT FOUND )
            document = await (ctx as any).create(createArgs);
            created=true;
          }
          return {created, document};
        },
        findManyAndCount<Model, Args>(
          this: Model,
          args: Prisma.Exact<Args, Prisma.Args<Model, 'findMany'>>
        ): Promise<[Prisma.Result<Model, Args, 'findMany'>, number]> {
          return prisma.$transaction([
            (this as any).findMany(args),
            (this as any).count({ where: (args as any).where })
          ]) as any;
        },
        findById<T, A extends Omit<Prisma.Args<T, 'findFirstOrThrow'>, 'where' >>(
          this: T,
          id: string,
          args?: A
        ):Promise< Prisma.Result<T, A, 'findFirstOrThrow'> >{
          const ctx = Prisma.getExtensionContext(this);
          return  (ctx as any).findFirstOrThrow({where:{id}, ...args});
        },
        updateById<T, A extends Omit<Prisma.Args<T, 'update'>, 'where' >>(
          this: T,
          id: string,
          update: A
        ):Promise< Prisma.Result<T, A, 'update'> >{
          const ctx = Prisma.getExtensionContext(this);
          return  (ctx as any).update({where:{id}, ...update});
        },
        polish<T>(
          this:T, 
          valueToPolish:Prisma.Args<T, 'create'>['data'], //corresponding model input type
          schemaName = Prisma.getExtensionContext(this).$name
        ) :NonNull< Prisma.Result<T, undefined, 'findFirst'> >/* corresponding model return type */ {
          // let t:Prisma.Result<T, undefined, 'findFirst'>;
          /* TODO: explore Prisma.TypeMap */
          let ctx = Prisma.getExtensionContext(this);
          if(Array.isArray(valueToPolish))//@ts-expect-error
            return valueToPolish.map(v=>this.polish(v, schemaName)) // handle arrays of schema values
          if(typeof valueToPolish !== 'object' || valueToPolish === null)
            return valueToPolish;
          let schemaReference = Prisma.dmmf.datamodel.models.find(m=>m.name==schemaName) || Prisma.dmmf.datamodel.types.find(t=>t.name==schemaName);
          // console.log('SCHEMA_NAME', schemaName);
          // console.log('SCHEMA', schemaReference); //DEBUG
          let polishedData = {} as NonNull< Prisma.Result<T, undefined, 'findFirst'> >;
          schemaReference?.fields.forEach(field=>{
            // console.log('FIELD', field); //DEBUG
            let value = valueToPolish[field.name];
            if(value==undefined) // SOURCE FROM DBNAME such as __v in the case that v doesnt exist
              value=(field.dbName && valueToPolish[field.dbName])
            // console.log('value', value); //DEBUG
            if(field.kind === 'object') {
              //@ts-expect-error
              value = this.polish(value, field.type); //Prisma.getExtensionContext(this) this is helpful too, in case of differing order of definition
            }
            //@ts-expect-error
            polishedData[field.name] = value;
          });
          // console.log('OG',modelName,Object.keys(valueToPolish)); //DEBUG
          // console.log('POLISHED', modelName, Object.keys(polishedData)); //DEBUG
          return polishedData;
        }
      },
    },
  })
}
/*
{
  id: '123',
  game_found:{...game_found, log_time, created_at:new Date()},
  chat: [],
  missions: {1:null, 2:null,3:null,4:null,5:null},
  game_start: null,
  game_end: null,
  game_players: {0:null,1:null, 2:null,3:null,4:null,5:null,6:null,7:null},
  player_ids: [],
  created_at: new Date(),
  updated_at: new Date(),
}
*/
declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const database = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV === 'development') globalThis.prismaGlobal = database;

//awesome post for features: https://github.com/prisma/prisma/issues/7161#issuecomment-1026317110
//custom computed fields: https://www.prisma.io/docs/orm/prisma-client/queries/computed-fields
//custom validation: https://www.prisma.io/docs/concepts/components/prisma-client/custom-validation
// !!! custom models: .findManyByDomain() : https://www.prisma.io/docs/concepts/components/prisma-client/custom-validation



//WHOA figure out this typing: (done, it creates a __typename Result extension that is mapped to modelName)

// const typeExtension = Prisma.defineExtension((client) => {
//   type ModelKey = Exclude<keyof typeof client, `$${string}` | symbol>;
//   type Result = {
//     [K in ModelKey]: { __typename: { needs: Record<string, never>; compute: () => K } };
//   };

//   const result = {} as Result;
//   const modelKeys = Object.keys(client).filter((key) => !key.startsWith('$')) as ModelKey[];
//   modelKeys.forEach((k) => {
//     result[k] = { __typename: { needs: {}, compute: () => k as any } };
//   });

//   return client.$extends({ result });
// });

// type ExtensionArgs = Extract<
//   Parameters<typeof database.$extends>["0"],
//   { name?: string }
// >