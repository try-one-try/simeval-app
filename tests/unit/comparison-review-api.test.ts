// HTTP 校验复用真实路由：同源、会话、角色、版本和统一错误结构。
import {beforeEach,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({auth:vi.fn(),user:vi.fn(),comparison:vi.fn(),list:vi.fn(),detail:vi.fn(),review:vi.fn()}));
vi.mock("@/auth",()=>({auth:mocks.auth}));
vi.mock("@/server/repositories/user-repository",()=>({userRepository:{findById:mocks.user}}));
vi.mock("@/server/application/comparison-review",()=>({comparisonReviewService:mocks}));
import {GET as comparison} from "@/app/api/comparisons/route";
import {GET as list} from "@/app/api/anomaly-samples/route";
import {PATCH} from "@/app/api/anomaly-samples/[sampleId]/review/route";
import {AppError} from "@/domain/evaluation";
const ctx={params:Promise.resolve({sampleId:"sample"})};
const body={conclusion:"待确认结论",mode:"draft",expectedVersion:1};
const patch=(change:Partial<RequestInit>={})=>new Request("http://localhost:3000/api/anomaly-samples/sample/review",{method:"PATCH",headers:{origin:"http://localhost:3000","content-type":"application/json"},body:JSON.stringify(body),...change});
beforeEach(()=>{vi.clearAllMocks();mocks.auth.mockResolvedValue({user:{id:"user"}});mocks.user.mockResolvedValue({id:"user",role:"ENGINEER",email:"engineer@demo.simeval.local",isDemo:true});mocks.review.mockResolvedValue({sample:{version:2}});});
it("未登录 401，评测人员不能读模型比较",async()=>{
 mocks.auth.mockResolvedValue(null);expect((await PATCH(patch(),ctx)).status).toBe(401);
 mocks.auth.mockResolvedValue({user:{id:"user"}});mocks.user.mockResolvedValue({id:"user",role:"REVIEWER",email:"reviewer@demo.simeval.local",isDemo:true});
 expect((await comparison(new Request("http://localhost:3000/api/comparisons?candidateRunId=run"))).status).toBe(403);
 expect(mocks.comparison).not.toHaveBeenCalled();
});
it("跨站、非 JSON、空结论、无效版本和旧分类均不进入服务",async()=>{
 expect((await PATCH(patch({headers:{origin:"http://evil.invalid","content-type":"application/json"}}),ctx)).status).toBe(403);
 expect((await PATCH(patch({body:"{"}),ctx)).status).toBe(422);
 for(const change of [{conclusion:" "},{expectedVersion:0},{category:"DATA_ISSUE"}])
 expect((await PATCH(patch({body:JSON.stringify({...body,...change})}),ctx)).status).toBe(422);
 expect(mocks.review).not.toHaveBeenCalled();
});
it("校验分页和可选基线，将冲突映射为 409 并携带请求号",async()=>{
 expect((await list(new Request("http://localhost:3000/api/anomaly-samples?runId=run&page=0"))).status).toBe(422);
 mocks.comparison.mockResolvedValue({baseline:null});expect((await comparison(new Request("http://localhost:3000/api/comparisons?candidateRunId=run"))).status).toBe(200);
 mocks.review.mockRejectedValue(new AppError("VERSION_CONFLICT","已更新",409));
 const response=await PATCH(patch(),ctx);expect(response.status).toBe(409);expect((await response.json()).error.requestId).toBeTruthy();
});
it("成功响应携带新版本与请求号，服务收到实际身份",async()=>{
 const response=await PATCH(patch(),ctx),payload=await response.json();
 expect(response.status).toBe(200);expect(payload.data.sample.version).toBe(2);
 expect(mocks.review.mock.calls[0][0]).toMatchObject({id:"user",role:"ENGINEER",requestId:payload.meta.requestId});
});
