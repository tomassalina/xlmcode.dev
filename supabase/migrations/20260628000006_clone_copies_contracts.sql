-- Clones must be functional: the cloned app's code may reference CONTRACTS[...],
-- so always copy the deployed_contracts rows (templates AND user/shared projects).
-- For shared singletons (Soroswap, USDC) this is exactly right. For owned tokens
-- the clone references the source contract; deploying a fresh owned instance is a
-- follow-up the cloner can do from the Contracts tab.
create or replace function clone_project(p_source uuid, p_share_token text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src       projects%rowtype;
  new_id    uuid;
  allowed   boolean;
  candidate text;
  new_slug  text;
  i         int := 0;
begin
  select * into src from projects where id = p_source;
  if not found then raise exception 'source not found'; end if;

  allowed := (src.owner_id = (select auth.uid()))
    or src.is_template
    or (p_share_token is not null and exists (
          select 1 from project_shares where project_id = p_source and token = p_share_token));
  if not allowed then raise exception 'not allowed'; end if;

  candidate := src.name || ' (Clone)';
  while exists (select 1 from projects where owner_id = (select auth.uid()) and name = candidate) loop
    i := i + 1;
    candidate := src.name || ' (Clone ' || i || ')';
  end loop;

  new_slug := left(src.slug, 40) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into projects (owner_id, slug, name, current_files, is_template, kind, published)
    values ((select auth.uid()), new_slug, candidate, src.current_files, false, null, false)
    returning id into new_id;

  insert into project_versions (project_id, seq, label, summary, files, created_at)
    select new_id, seq, label, summary, files, created_at
    from project_versions where project_id = p_source;

  insert into messages (project_id, seq, role, content, files, stats, actions, actions_done, kind, model_type, prompt_tokens, completion_tokens, cost_usd, created_at)
    select new_id, seq, role, content, files, stats, actions, actions_done, kind, model_type, 0, 0, 0, created_at
    from messages where project_id = p_source;

  insert into deployed_contracts (project_id, manifest_id, name, category, contract_id, network, tx_hash, explorer_url, deployer, config, created_at)
    select new_id, manifest_id, name, category, contract_id, network, tx_hash, explorer_url, deployer, config, created_at
    from deployed_contracts where project_id = p_source;

  return new_id;
end;
$$;
