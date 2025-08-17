
# Clean, extensible, versioned REST API for DataProduct

A crisp, production-ready architecture that turns CRUD into composable flows: versioned strategies orchestrate handler chains over a clear repository/mapper boundary. This gives you predictable change control, reliable evolution, and fast delivery without code sprawl.

---

## Executive summary

- **Problem:** Monolithic controllers and tangled logic slow delivery and make change risky.
- **Solution:** Strategy + Factory for versioning, Chain of Responsibility for orchestration, Repository + Mapper for persistence isolation, all wired with DI to enforce SRP and testability.
- **Outcome:** Code reads like a sequence diagram, versions evolve without duplication, and changes are provably safe through granular tests.

---

## Architecture overview

### System flow

```@startuml
left to right direction

rectangle "HTTP Controller" as A
rectangle "Strategy Factory" as B
rectangle "Versioned Strategy (v1/v2/...)" as C
rectangle "Handler Chain" as D
rectangle "Validate Handler" as D1
rectangle "Business Handler" as D2
rectangle "Audit Handler" as D3
rectangle "Message Handler" as D4
rectangle "Repository (Interface)" as E
database "MongoDB" as F
database "Alt: SQL" as G
queue "Kafka/Queue" as MQ

A --> B
B --> C
C --> D
D --> D1
D --> D2
D --> D3
D --> D4
D2 --> E
E --> F
E --> G
D1 -[#blue]-> D2 : DTO
D2 -[#blue]-> E : Entity/DTO
E -[#blue]-> D2 : Entity
D3 -[#blue]-> E : Audit Record
D4 -[#blue]-> MQ : Event

@enduml

```

- **Controller:** Slim entry-point; delegates orchestration to strategies based on API version.
- **Strategy:** Version-specific coordinator that composes the handler chain for each operation.
- **Handlers:** Small, single-purpose steps that form a linear, readable pipeline.
- **Repository/Mapper:** Clean boundary between business and persistence; swap databases without touching orchestration.

### Module layout

```
src/
  data-product/
    controller/
      data-product.controller.ts
    strategies/
      data-product.strategy.interface.ts
      data-product.strategy.v1.ts
      data-product.strategy.v2.ts
      data-product.strategy.factory.ts
    handlers/
      base.handler.ts
      create/v1
        validate-create.handler.ts
        business-create.v1.handler.ts
        audit-create.handler.ts
        message-create.handler.ts
      update/
        validate-update.handler.ts
        business-update.v1.handler.ts
        business-update.v2.handler.ts
        audit-update.handler.ts
        message-update.handler.ts
    domain/
      data-product.dto.ts
      data-product.entity.ts
      data-product.mapper.ts
      data-product.repository.interface.ts
    infra/
      mongoose/
        data-product.schema.ts
        data-product.mongoose.repository.ts
    data-product.module.ts
```

- **Clear boundaries:** Domain (DTO, entity, repo interface) stays stable; infra is swappable; strategies/handlers evolve with business.

---

## Principles and patterns

- **SRP:** Each class has one job (e.g., “Validate update”, “Audit create”). This shrinks blast radius and clarifies ownership.
- **OCP:** New versions extend behavior via new strategies/handlers, not edits to stable code.
- **LSP:** Any strategy implementing the interface can serve requests seamlessly.
- **ISP:** Small interfaces (strategy, repository, handler) keep dependencies tight and focused.
- **DIP:** High-level orchestration depends on abstractions (repo interface), not concrete DB.

- **Strategy:** Encapsulates version-specific orchestration logic per operation.
- **Factory:** Centralizes version selection; controllers don’t know about versions.
- **Chain of Responsibility:** Declarative, ordered, reusable steps — reads like a playbook.
- **Repository:** Swappable persistence with a consistent domain-facing contract.
- **Mapper:** DTO/entity translation to keep API contract independent of DB schema.

---

## Implementation details with explanations

### DTO with input contracts

```ts
// src/data-product/domain/data-product.dto.ts
import { IsOptional, IsString, IsIn, Length } from 'class-validator';

export class DataProductDto {
  @IsOptional() id?: string;

  @IsString() @Length(3, 100)
  name!: string;

  @IsOptional() @IsString() @Length(0, 500)
  description?: string;

  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @IsOptional() createdAt?: Date;
  @IsOptional() updatedAt?: Date;
}
```

- **Contract clarity:** Validates transport shape early; schema rules live near the API surface.
- **SRP alignment:** Business rules beyond shape go to dedicated Validate handlers.

---

### Entity and Mongoose schema

```ts
// src/data-product/infra/mongoose/data-product.schema.ts
import { Schema, model, Document } from 'mongoose';

export interface DataProductEntity extends Document {
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const DataProductSchema = new Schema<DataProductEntity>(
  {
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

export const DataProductModel = model<DataProductEntity>('DataProduct', DataProductSchema);
```

- **Persistence concerns:** DB specifics contained in infra; domain unaware of Mongoose.
- **Change isolation:** Schema evolution has no impact on DTOs or orchestration.

---

### Mapper for DTO ↔ entity

```ts
// src/data-product/domain/data-product.mapper.ts
import { DataProductDto } from './data-product.dto';
import { DataProductEntity } from '../infra/mongoose/data-product.schema';

export class DataProductMapper {
  static toDto(entity: DataProductEntity): DataProductDto {
    return {
      id: entity._id.toString(),
      name: entity.name,
      description: entity.description,
      status: entity.status,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toEntity(dto: DataProductDto): Partial<DataProductEntity> {
    return {
      name: dto.name,
      description: dto.description,
      status: dto.status ?? 'ACTIVE',
    };
  }
}
```

- **Decoupling:** DB identifiers and timestamps are normalized for the API.
- **Testability:** Mappers are pure, easily unit-tested, and deterministic.

---

### Repository interface and Mongoose implementation

```ts
// src/data-product/domain/data-product.repository.interface.ts
import { DataProductDto } from './data-product.dto';

export interface DataProductRepository {
  create(dto: DataProductDto): Promise<DataProductDto>;
  findById(id: string): Promise<DataProductDto | null>;
  update(id: string, dto: DataProductDto): Promise<DataProductDto>;
  delete(id: string): Promise<void>;
}
```

```ts
// src/data-product/infra/mongoose/data-product.mongoose.repository.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataProductRepository } from '../../domain/data-product.repository.interface';
import { DataProductDto } from '../../domain/data-product.dto';
import { DataProductModel } from './data-product.schema';
import { DataProductMapper } from '../../domain/data-product.mapper';

@Injectable()
export class MongooseDataProductRepository implements DataProductRepository {
  async create(dto: DataProductDto): Promise<DataProductDto> {
    const created = await DataProductModel.create(DataProductMapper.toEntity(dto));
    return DataProductMapper.toDto(created);
  }

  async findById(id: string): Promise<DataProductDto | null> {
    const found = await DataProductModel.findById(id).exec();
    return found ? DataProductMapper.toDto(found) : null;
  }

  async update(id: string, dto: DataProductDto): Promise<DataProductDto> {
    const updated = await DataProductModel.findByIdAndUpdate(
      id,
      DataProductMapper.toEntity(dto),
      { new: true, runValidators: true }
    ).exec();
    if (!updated) throw new NotFoundException(`DataProduct ${id} not found`);
    return DataProductMapper.toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const res = await DataProductModel.findByIdAndDelete(id).exec();
    if (!res) throw new NotFoundException(`DataProduct ${id} not found`);
  }
}
```

- **DIP in practice:** Strategies/handlers depend on the interface, not the Mongoose class.
- **Swap ready:** Replacing Mongo with SQL only changes this file and its wiring.

---

### Handler base and concrete handlers

```ts
// src/data-product/handlers/base.handler.ts
export abstract class Handler<T> {
  private next?: Handler<T>;

  setNext<U extends Handler<T>>(handler: U): U {
    this.next = handler;
    return handler;
  }

  async handle(context: T): Promise<void> {
    await this.process(context);
    if (this.next) await this.next.handle(context);
  }

  protected abstract process(context: T): Promise<void>;
}
```

- **Composable sequencing:** setNext returns the next handler for fluent chains.
- **SRP enforced:** Each handler’s process method owns exactly one responsibility.

```ts
// src/data-product/handlers/update/validate-update.handler.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Handler } from '../base.handler';
import { DataProductDto } from '../../domain/data-product.dto';

@Injectable()
export class ValidateUpdateHandler extends Handler<DataProductDto> {
  protected async process(dto: DataProductDto): Promise<void> {
    if (!dto.id) throw new BadRequestException('id is required for update');
    if (dto.name && dto.name.trim().length < 3) {
      throw new BadRequestException('name must be at least 3 characters');
    }
    // Add versioned business rule validations here (status transitions, etc.)
  }
}
```

- **Business validation:** Goes beyond shape validation; expresses domain rules.
- **Change localization:** New rules add here without touching other steps.

```ts
// src/data-product/handlers/update/business-update.v1.handler.ts
import { Injectable } from '@nestjs/common';
import { Handler } from '../base.handler';
import { DataProductRepository } from '../../domain/data-product.repository.interface';
import { DataProductDto } from '../../domain/data-product.dto';

@Injectable()
export class BusinessUpdateV1Handler extends Handler<DataProductDto> {
  constructor(private readonly repo: DataProductRepository) { super(); }

  protected async process(dto: DataProductDto): Promise<void> {
    await this.repo.update(dto.id!, dto);
  }
}
```

- **Side-effect boundary:** Only this step touches the repository for “update.”
- **Version awareness:** V2 can override this with evolved logic.

```ts
// src/data-product/handlers/update/business-update.v2.handler.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Handler } from '../base.handler';
import { DataProductRepository } from '../../domain/data-product.repository.interface';
import { DataProductDto } from '../../domain/data-product.dto';

@Injectable()
export class BusinessUpdateV2Handler extends Handler<DataProductDto> {
  constructor(private readonly repo: DataProductRepository) { super(); }

  protected async process(dto: DataProductDto): Promise<void> {
    const current = await this.repo.findById(dto.id!);
    if (!current) throw new BadRequestException('Cannot update non-existent DataProduct');

    // Example: Prevent name changes in v2; only description/status allowed
    if (dto.name && dto.name !== current.name) {
      throw new BadRequestException('name is immutable in v2');
    }
    await this.repo.update(dto.id!, { ...current, ...dto, name: current.name });
  }
}
```

- **Versioned policy:** Encodes new rules without breaking v1 behavior.
- **Risk control:** Old consumers stay stable; new consumers opt-in to stricter rules.

```ts
// src/data-product/handlers/update/audit-update.handler.ts
import { Injectable } from '@nestjs/common';
import { Handler } from '../base.handler';
import { DataProductDto } from '../../domain/data-product.dto';

@Injectable()
export class AuditUpdateHandler extends Handler<DataProductDto> {
  protected async process(dto: DataProductDto): Promise<void> {
    // Persist an audit trail via a separate repository/table/stream (omitted for brevity)
    // Example: auditRepo.save({ entityId: dto.id, action: 'UPDATE', ... })
  }
}
```

- **Cross-cutting:** Auditing isolated from business logic; can be reused across versions.

```ts
// src/data-product/handlers/update/message-update.handler.ts
import { Injectable } from '@nestjs/common';
import { Handler } from '../base.handler';
import { DataProductDto } from '../../domain/data-product.dto';

@Injectable()
export class MessageUpdateHandler extends Handler<DataProductDto> {
  protected async process(dto: DataProductDto): Promise<void> {
    // Publish domain event (e.g., Kafka) e.g., messageBus.publish('dataProduct.updated', dto)
  }
}
```

- **Event-first posture:** Decouples downstream consumers; easy to toggle per version.

---

### Strategy interface and implementations

```ts
// src/data-product/strategies/data-product.strategy.interface.ts
import { DataProductDto } from '../domain/data-product.dto';

export interface DataProductStrategy {
  create(dto: DataProductDto): Promise<DataProductDto>;
  get(id: string): Promise<DataProductDto | null>;
  update(id: string, dto: DataProductDto): Promise<DataProductDto>;
  delete(id: string): Promise<void>;
}
```

- **LSP-ready:** Any version can plug in without controller changes.

```ts
// src/data-product/strategies/data-product.strategy.v1.ts
import { Injectable } from '@nestjs/common';
import { DataProductStrategy } from './data-product.strategy.interface';
import { DataProductDto } from '../domain/data-product.dto';
import { ValidateUpdateHandler } from '../handlers/update/validate-update.handler';
import { BusinessUpdateV1Handler } from '../handlers/update/business-update.v1.handler';
import { AuditUpdateHandler } from '../handlers/update/audit-update.handler';
import { MessageUpdateHandler } from '../handlers/update/message-update.handler';
import { DataProductRepository } from '../domain/data-product.repository.interface';

@Injectable()
export class DataProductStrategyV1 implements DataProductStrategy {
  constructor(
    private readonly repo: DataProductRepository,
    private readonly validateUpdate: ValidateUpdateHandler,
    private readonly businessUpdateV1: BusinessUpdateV1Handler,
    private readonly auditUpdate: AuditUpdateHandler,
    private readonly messageUpdate: MessageUpdateHandler
  ) {}

  async create(dto: DataProductDto): Promise<DataProductDto> {
    // For brevity: create chain mirrors update (validate -> business -> audit -> message)
    return this.repo.create(dto);
  }

  async get(id: string): Promise<DataProductDto | null> {
    return this.repo.findById(id);
  }

  async update(id: string, dto: DataProductDto): Promise<DataProductDto> {
    dto.id = id;
    this.validateUpdate
      .setNext(this.businessUpdateV1)
      .setNext(this.auditUpdate)
      .setNext(this.messageUpdate);
    await this.validateUpdate.handle(dto);
    // Repo returns final entity; fetch to return the latest representation
    const updated = await this.repo.findById(id);
    return updated!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
```

- **Readable orchestration:** Fluent chaining exposes the execution story.
- **Reuse-first:** Shared handlers stay in v1; no duplication across operations.

```ts
// src/data-product/strategies/data-product.strategy.v2.ts
import { Injectable } from '@nestjs/common';
import { DataProductStrategy } from './data-product.strategy.interface';
import { DataProductDto } from '../domain/data-product.dto';
import { ValidateUpdateHandler } from '../handlers/update/validate-update.handler';
import { BusinessUpdateV2Handler } from '../handlers/update/business-update.v2.handler';
import { AuditUpdateHandler } from '../handlers/update/audit-update.handler';
import { MessageUpdateHandler } from '../handlers/update/message-update.handler';
import { DataProductStrategyV1 } from './data-product.strategy.v1';

@Injectable()
export class DataProductStrategyV2 implements DataProductStrategy {
  constructor(
    private readonly v1: DataProductStrategyV1,
    private readonly validateUpdate: ValidateUpdateHandler,
    private readonly businessUpdateV2: BusinessUpdateV2Handler,
    private readonly auditUpdate: AuditUpdateHandler,
    private readonly messageUpdate: MessageUpdateHandler
  ) {}

  async create(dto: DataProductDto): Promise<DataProductDto> {
    return this.v1.create(dto); // unchanged in v2
  }

  async get(id: string): Promise<DataProductDto | null> {
    return this.v1.get(id); // unchanged in v2
  }

  async update(id: string, dto: DataProductDto): Promise<DataProductDto> {
    dto.id = id;
    this.validateUpdate
      .setNext(this.businessUpdateV2)
      .setNext(this.auditUpdate)
      .setNext(this.messageUpdate);
    await this.validateUpdate.handle(dto);
    return (await this.v1.get(id))!;
  }

  async delete(id: string): Promise<void> {
    return this.v1.delete(id); // unchanged in v2
  }
}
```

- **OCP embodiment:** Only override what changed; delegate the rest.
- **Diff-friendly:** PRs show tight, isolated changes per version.

---

### Strategy factory and controller

```ts
// src/data-product/strategies/data-product.strategy.factory.ts
import { Injectable } from '@nestjs/common';
import { DataProductStrategy } from './data-product.strategy.interface';
import { DataProductStrategyV1 } from './data-product.strategy.v1';
import { DataProductStrategyV2 } from './data-product.strategy.v2';

@Injectable()
export class DataProductStrategyFactory {
  private readonly strategies = new Map<string, DataProductStrategy>();

  constructor(v1: DataProductStrategyV1, v2: DataProductStrategyV2) {
    this.strategies.set('v1', v1);
    this.strategies.set('v2', v2);
  }

  get(version?: string): DataProductStrategy {
    return this.strategies.get(version ?? 'v1') ?? this.strategies.get('v1')!;
  }
}
```

```ts
// src/data-product/controller/data-product.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body, Headers } from '@nestjs/common';
import { DataProductDto } from '../domain/data-product.dto';
import { DataProductStrategyFactory } from '../strategies/data-product.strategy.factory';

@Controller('dataproducts')
export class DataProductController {
  constructor(private readonly factory: DataProductStrategyFactory) {}

  @Post()
  async create(
    @Body() dto: DataProductDto,
    @Headers('x-api-version') version?: string
  ) {
    return this.factory.get(version).create(dto);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Headers('x-api-version') version?: string) {
    return this.factory.get(version).get(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: DataProductDto,
    @Headers('x-api-version') version?: string
  ) {
    return this.factory.get(version).update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Headers('x-api-version') version?: string) {
    return this.factory.get(version).delete(id);
  }
}
```

- **Slim surface:** Controllers route requests; orchestration belongs elsewhere.
- **Version routing:** Headers allow client choice; routes stay stable.

---

### Wiring providers in the module

```ts
// src/data-product/data-product.module.ts
import { Module } from '@nestjs/common';
import { DataProductController } from './controller/data-product.controller';
import { DataProductStrategyFactory } from './strategies/data-product.strategy.factory';
import { DataProductStrategyV1 } from './strategies/data-product.strategy.v1';
import { DataProductStrategyV2 } from './strategies/data-product.strategy.v2';
import { ValidateUpdateHandler } from './handlers/update/validate-update.handler';
import { BusinessUpdateV1Handler } from './handlers/update/business-update.v1.handler';
import { BusinessUpdateV2Handler } from './handlers/update/business-update.v2.handler';
import { AuditUpdateHandler } from './handlers/update/audit-update.handler';
import { MessageUpdateHandler } from './handlers/update/message-update.handler';
import { MongooseDataProductRepository } from './infra/mongoose/data-product.mongoose.repository';

@Module({
  controllers: [DataProductController],
  providers: [
    // Strategies
    DataProductStrategyFactory,
    DataProductStrategyV1,
    DataProductStrategyV2,
    // Handlers
    ValidateUpdateHandler,
    BusinessUpdateV1Handler,
    BusinessUpdateV2Handler,
    AuditUpdateHandler,
    MessageUpdateHandler,
    // Repository (bind to interface by convention or custom provider token)
    { provide: 'DataProductRepository', useClass: MongooseDataProductRepository },
    // If using tokens, inject via @Inject('DataProductRepository')
  ],
})
export class DataProductModule {}
```

- **DIP wiring:** Interface-to-implementation mapping centralized here.
- **Swap mechanism:** Replace `useClass` to roll out a new persistence layer.

---

## UML class diagrams

```@startuml

class DataProductController {
  +create(dto, version)
  +get(id, version)
  +update(id, dto, version)
  +delete(id, version)
}

class DataProductStrategyFactory {
  +get(version) : DataProductStrategy
}

interface DataProductStrategy {
  +create(dto) : DataProductDto
  +get(id) : DataProductDto
  +update(id, dto) : DataProductDto
  +delete(id) : void
}

class DataProductStrategyV1
class DataProductStrategyV2

class Handler<T> {
  -next : Handler<T>
  +setNext(handler) : Handler<T>
  +handle(context) : Promise<void>
  #process(context) : Promise<void>
}

class ValidateUpdateHandler
class BusinessUpdateV1Handler
class BusinessUpdateV2Handler
class AuditUpdateHandler
class MessageUpdateHandler

interface DataProductRepository {
  +create(dto) : DataProductDto
  +findById(id) : DataProductDto
  +update(id, dto) : DataProductDto
  +delete(id) : void
}

class MongooseDataProductRepository
class DataProductMapper
class DataProductDto
class DataProductEntity

DataProductController --> DataProductStrategyFactory
DataProductStrategyFactory --> DataProductStrategy
DataProductStrategy <|.. DataProductStrategyV1
DataProductStrategy <|.. DataProductStrategyV2

Handler <|-- ValidateUpdateHandler
Handler <|-- BusinessUpdateV1Handler
Handler <|-- BusinessUpdateV2Handler
Handler <|-- AuditUpdateHandler
Handler <|-- MessageUpdateHandler

BusinessUpdateV1Handler --> DataProductRepository
BusinessUpdateV2Handler --> DataProductRepository
DataProductRepository <|.. MongooseDataProductRepository

DataProductMapper --> DataProductDto
DataProductMapper --> DataProductEntity

@enduml
```

- **Separation of concerns:** Strategies orchestrate; handlers execute; repositories persist.
- **Extensibility path:** New versions add new handler subclasses and a strategy.

---

## Sequence diagrams

### Update flow (v2)

```@startuml
actor C as Controller
participant F as StrategyFactory
participant S as StrategyV2
participant V as ValidateUpdateHandler
participant B as BusinessUpdateV2Handler
participant A as AuditUpdateHandler
participant M as MessageUpdateHandler
participant R as Repository

C ->> F : get("v2")
F -->> C : StrategyV2

C ->> S : update(id, dto)

activate S
  S ->> V : handle(dto+id)
  activate V
    V -->> S : ok
  deactivate V

  S ->> B : handle(dto)
  activate B
    B ->> R : findById(id)
    activate R
      R -->> B : current
    deactivate R

    B ->> R : update(id, mergedDto)
    activate R
      R -->> B : updated
    deactivate R

    B -->> S : ok
  deactivate B

  S ->> A : handle(dto)
  activate A
    A -->> S : ok
  deactivate A

  S ->> M : handle(dto)
  activate M
    M -->> S : ok
  deactivate M
deactivate S

S -->> C : updated dto
@enduml

```

- **Linear narrative:** Each step has one intent; errors bubble up predictably.
- **Versioned gate:** Business rules applied before persistence.

### Create flow (v1)

```@startuml
participant C as Controller
participant F as StrategyFactory
participant S as StrategyV1
participant V as ValidateCreateHandler
participant B as BusinessCreateV1Handler
participant A as AuditCreateHandler
participant M as MessageCreateHandler
participant R as Repository

C ->> F : get("v1")
F -->> C : StrategyV1
C ->> S : create(dto)
S ->> V : handle(dto)
V -->> S : ok
S ->> B : handle(dto)
B ->> R : create(dto)
R -->> B : created
B -->> S : ok
S ->> A : handle(dto)
A -->> S : ok
S ->> M : handle(dto)
M -->> S : ok
S -->> C : created dto
@enduml

```

- **Reusability:** Swap `B` or `V` for new versions; rest stays intact.

---

## Versioning and evolution

- **Add v3:** Implement `BusinessUpdateV3Handler` for changed rules, create `DataProductStrategyV3` delegating unchanged ops to v2, register in the factory.
- **Deprecation:** Keep old strategies stable; mark endpoints with sunset headers; route traffic via header or negotiated default.
- **Selective evolution:** Different operations can evolve in different versions independently (e.g., update in v2, create still v1).

> Tip: Keep a “version delta log” per operation listing changed handlers and rules. It reduces cognitive load during reviews.

---

## Testing and quality

- **Unit tests:**
  - **Handlers:** Mock repository; assert rule enforcement and side-effects.
  - **Strategies:** Stub handlers to assert chain order and error propagation.
  - **Mappers:** Pure function tests for DTO/entity fidelity.
- **Integration tests:**
  - **Strategy + real handlers + in-memory repo:** Validate end-to-end orchestration without external DB.
- **E2E tests:**
  - **Controllers + version headers:** Confirm routing to correct strategies and stable API contracts.

```ts
// Example handler unit test (Jest)
it('v2 blocks name change', async () => {
  const repo = { findById: jest.fn().mockResolvedValue({ id: '1', name: 'fixed' }),
                 update: jest.fn() } as any;
  const handler = new BusinessUpdateV2Handler(repo);
  await expect(handler['process']({ id: '1', name: 'new' } as any))
    .rejects.toThrow('name is immutable in v2');
});
```

- **Faster feedback:** Most tests run without network/DB; failures pinpoint exact components.

---

## Operational and team practices

- **Maintainability:**
  - **Explicit ownership:** Small files per handler; reviewers specialize.
  - **Localized diffs:** Version changes touch few files; easy rollbacks.
- **Readability:**
  - **Names as documentation:** Handlers declare intent; strategies declare sequence.
  - **uml-first:** Keep diagrams alongside code to teach structure visually.
- **Time to market:**
  - **Parallel work streams:** Different handlers/versions can be developed concurrently.
  - **Safe releases:** Feature flags at the strategy-factory layer enable controlled rollout.

### Performance and resiliency notes

- **Handler overhead:** Minimal function call cost; optimize only if profiling indicates.
- **Idempotency:** Message handlers should be idempotent to avoid duplicate downstream effects.
- **Bulk operations:** Compose specialized handlers (e.g., `BatchUpdateHandler`) while reusing validation/audit steps.

### Common pitfalls and mitigations

- **Over-granularity:** Too many micro-handlers can obscure the narrative.
  - **Mitigation:** Each handler must deliver a business-meaningful step.
- **Leaky abstractions:** Reaching into DB specifics from handlers.
  - **Mitigation:** Keep DB specifics inside repository; expose intent-based methods.
- **Version sprawl:** Too many versions increase maintenance burden.
  - **Mitigation:** Sunset policy and consolidation milestones per quarter.

---

## Appendix: quick-reference tables

### Qualities mapping

| Quality | Mechanism | Practical impact |
|---|---|---|
| Readability | CoR + descriptive names | Code equals sequence diagram |
| Maintainability | SRP + DIP | Small, safe changes |
| Extensibility | Strategy + Factory | Add versions without rewrites |
| Time to market | Modular tests | Faster, confident releases |

### v1 vs v2 (update)

| Aspect | v1 | v2 |
|---|---|---|
| Name mutability | Allowed | Disallowed |
| Business handler | BusinessUpdateV1Handler | BusinessUpdateV2Handler |
| Other handlers | Same | Same |


