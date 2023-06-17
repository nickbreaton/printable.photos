import { IDBPDatabase, openDB } from "idb";

interface ColumnOptions {
  primaryKey?: boolean;
  index?: boolean;
}

interface Column extends ColumnOptions {
  name: string;
}

function column(options: ColumnOptions = {}) {
  return function (_: unknown, descriptor: ClassFieldDecoratorContext): void {
    const initializer = function (this: BaseModel) {
      this.$$columns.push({ ...options, name: String(descriptor.name) });
    };
    return initializer as any; // TODO: typescript doesn't seem to work the same way as the spec
  };
}

function memoize() {
  return function (_: unknown, descriptor: ClassMethodDecoratorContext) {
    // TODO
  };
}

abstract class BaseModel {
  public $$columns: Column[] = [];

  static $$dbPromise: Promise<IDBPDatabase>;
  static $$models: Record<string, typeof BaseModel>;

  static load() {}

  static async all() {
    const db = await this.$$dbPromise;
    const tx = db.transaction(this.getModelName(), "readonly");
    return tx.store.getAll();
  }

  fill() {}

  async save() {
    const db = await this.getDatabase();
    const objectToSave: Partial<this> = {};

    for (const column of this.$$columns) {
      objectToSave[column.name] = this[column.name];
    }

    const tx = db.transaction(this.getModelName(), "readwrite");

    await tx.store.put(objectToSave);
    await tx.done;
  }

  private getDatabase() {
    return BaseModel.$$dbPromise;
  }

  private getModelName(): string {
    for (const name in BaseModel.$$models) {
      if ((this as any).__proto__.constructor === BaseModel.$$models[name]) {
        return name;
      }
    }
    return null!;
  }

  private static getModelName(): string {
    for (const name in BaseModel.$$models) {
      if (this === BaseModel.$$models[name]) {
        return name;
      }
    }
    return null!;
  }
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

class Photo extends BaseModel {
  @column({ primaryKey: true })
  id: number;

  @column()
  name: string;

  @column()
  blob: Blob;

  @memoize()
  async getPhotoURL() {
    return URL.createObjectURL(this.blob);
  }
}

class Database {
  static async connect(name: string, version: number, models: Record<string, new () => BaseModel>) {
    const dbPromise = openDB(name, version, {
      upgrade(db) {
        for (const name in models) {
          const model = new models[name]();
          const columns = model.$$columns;

          const indexColumn = columns.find((column) => column.primaryKey);
          assert(indexColumn, `No index found for model "${model}"`);

          const objectStore = db.createObjectStore(name, {
            keyPath: indexColumn!.name,
            autoIncrement: true,
          });

          for (const column of columns) {
            if (column.index) {
              objectStore.createIndex(column.name, column.name);
            }
          }
        }
      },
    });

    (BaseModel.$$models as any) = models;
    (BaseModel.$$dbPromise as any) = dbPromise;
  }
}

async function run() {
  await Database.connect("projects", 1, {
    Photo,
  });

  const photo = new Photo();
  photo.id = 11;
  photo.name = "test.png";
  photo.blob = new Blob();
  await photo.save();

  console.log(await Photo.all());
}

run();
