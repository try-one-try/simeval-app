// 实际 HTTP 边界测试：身份、同源、JSON、参数与错误契约。
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/domain/evaluation";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),create:vi.fn(),list:vi.fn(),get:vi.fn(),remove:vi.fn(),options:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/server/repositories/user-repository",()=>({userRepository:{findById:mocks.user}}));
vi.mock("@/server/application/evaluation",()=>({evaluationService:{create:mocks.create,list:mocks.list,get:mocks.get,remove:mocks.remove,options:mocks.options},statusDto:(run:unknown)=>run}));
import { DELETE as removeRun } from "@/app/api/evaluation-runs/[runId]/route";
import { GET as catalogGET } from "@/app/api/evaluation-catalog/route";
import { GET,POST } from "@/app/api/evaluation-runs/route";
import { GET as statusGET } from "@/app/api/evaluation-runs/[runId]/status/route";
const body={name:"任务",modelVersionId:"candidate",datasetVersionId:"dataset",benchmarkId:"benchmark",baselineRunId:"baseline",episodeCount:200,simulationSeed:20260901,acceptQualityWarning:true};
function request(override:Partial<RequestInit>={}) { return new Request("http://localhost:3000/api/evaluation-runs",{method:"POST",headers:{"content-type":"application/json","origin":"http://localhost:3000","idempotency-key":"test-key"},body:JSON.stringify(body),...override}); }
beforeEach(()=>{ vi.clearAllMocks(); mocks.auth.mockResolvedValue({user:{id:"user"}}); mocks.user.mockResolvedValue({id:"user",role:"ENGINEER",email:"engineer@demo.simeval.local",isDemo:true}); mocks.create.mockResolvedValue({data:{id:"created"},replay:false}); });
it("未登录返回 401 JSON，复核员写入返回 403",async()=>{
  mocks.auth.mockResolvedValue(null); expect((await POST(request())).status).toBe(401);
  mocks.auth.mockResolvedValue({user:{id:"user"}}); mocks.user.mockResolvedValue({id:"user",role:"REVIEWER",email:"reviewer@demo.simeval.local",isDemo:true});
  const response=await POST(request());expect(response.status).toBe(403);expect(mocks.create).not.toHaveBeenCalled();
});
it("拒绝跨站或缺少 Origin 的写操作",async()=>{
  for(const origin of ["http://evil.invalid",""]) expect((await POST(request({headers:{"content-type":"application/json","origin":origin}}))).status).toBe(403);
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each([
  {role:"ADMIN",email:"admin@demo.simeval.local",isDemo:true},
  {role:"ENGINEER",email:"engineer@demo.simeval.local",isDemo:false},
  {role:"REVIEWER",email:"engineer@demo.simeval.local",isDemo:true},
])("旧会话账号不符合双身份约定时返回 401：$role/$isDemo",async(account)=>{
  mocks.user.mockResolvedValue({id:"user",...account});
  expect((await POST(request())).status).toBe(401);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("同源按真实 Host 校验，允许内部 localhost 与访问地址不同",async()=>{
  const response=await POST(request({headers:{"content-type":"application/json","host":"127.0.0.1:3000","origin":"http://127.0.0.1:3000","idempotency-key":"same-origin"}}));expect(response.status).toBe(201);
  expect((await POST(request({headers:{"content-type":"application/json","host":"127.0.0.1:3000","origin":"http://evil.invalid"}}))).status).toBe(403);
});
it("无效 JSON、缺失幂等键与越界字段返回 422",async()=>{
  expect((await POST(request({body:"{"}))).status).toBe(422);
  expect((await POST(request({headers:{"content-type":"application/json-fake","origin":"http://localhost:3000","idempotency-key":"key"}}))).status).toBe(422);
  expect((await POST(request({headers:{"content-type":"application/json","origin":"http://localhost:3000"}}))).status).toBe(422);
  const response=await POST(request({body:JSON.stringify({...body,episodeCount:0})}));
  expect(response.status).toBe(422);expect((await response.json()).error.fieldErrors.episodeCount).toBeDefined();
});
it("首次创建 201，幂等重放 200，并把请求号传到审计上下文",async()=>{
  const response=await POST(request());expect(response.status).toBe(201);
  const payload=await response.json();expect(payload.meta.requestId).toBeTruthy();
  expect(mocks.create.mock.calls[0][0].requestId).toBe(payload.meta.requestId);
  mocks.create.mockResolvedValue({data:{id:"created"},replay:true});expect((await POST(request())).status).toBe(200);
});
it("任务重名返回 409、名称字段反馈与请求号",async()=>{
  const message="已存在同名任务，请换一个任务名称";
  mocks.create.mockRejectedValue(new AppError("RUN_NAME_CONFLICT",message,409,{name:[message]}));
  const response=await POST(request());expect(response.status).toBe(409);
  const payload=await response.json();
  expect(payload.error).toMatchObject({code:"RUN_NAME_CONFLICT",message,fieldErrors:{name:[message]},requestId:expect.any(String)});
});
it("分页参数校验并返回 meta",async()=>{
  expect((await GET(new Request("http://localhost:3000/api/evaluation-runs?page=0"))).status).toBe(422);
  mocks.list.mockResolvedValue({data:[],total:0});
  const response=await GET(new Request("http://localhost:3000/api/evaluation-runs"));expect((await response.json()).meta).toMatchObject({page:1,pageSize:20,total:0});
});
it("GET status 只读，不调用创建或推进",async()=>{
  mocks.get.mockResolvedValue({status:"QUEUED"});
  const response=await statusGET(new Request("http://localhost:3000/api/evaluation-runs/run/status"),{params:Promise.resolve({runId:"run"})});
  expect(response.status).toBe(200);expect(mocks.get).toHaveBeenCalled();expect(mocks.create).not.toHaveBeenCalled();
});
it("未知错误返回通用 500 与请求号，不泄漏数据库错误",async()=>{
  const spy=vi.spyOn(console,"error").mockImplementation(()=>{});
  try{mocks.create.mockRejectedValue(new Error("database-password-secret"));
    const response=await POST(request());expect(response.status).toBe(500);
    const payload=await response.json();expect(payload.error.requestId).toBeTruthy();expect(JSON.stringify(payload)).not.toContain("database-password-secret");
  }finally{spy.mockRestore();}
});

it("目录返回安全数据；删除仍需会话、工程师和同源，错误契约一致",async()=>{
  mocks.options.mockResolvedValue({models:[],datasets:[],benchmarks:[],activeTaskLimit:3});
  const catalog=await catalogGET(new Request("http://localhost:3000/api/evaluation-catalog"));expect(catalog.status).toBe(200);expect((await catalog.json()).data.activeTaskLimit).toBe(3);
  const ctx={params:Promise.resolve({runId:"run"})};
  const req=(origin="http://localhost:3000")=>new Request("http://localhost:3000/api/evaluation-runs/run",{method:"DELETE",headers:{origin}});
  expect((await removeRun(req("http://evil.invalid"),ctx)).status).toBe(403);expect(mocks.remove).not.toHaveBeenCalled();
  mocks.remove.mockResolvedValue({id:"run",deletedAt:"2026-09-27T00:00:00Z"});expect((await removeRun(req(),ctx)).status).toBe(200);
  mocks.user.mockResolvedValue({id:"user",role:"REVIEWER",email:"reviewer@demo.simeval.local",isDemo:true});expect((await removeRun(req(),ctx)).status).toBe(403);
});
