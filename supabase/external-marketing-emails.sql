-- Extends the marketing pre-approval allow-list (from
-- marketing-role-and-suggestions.sql) with a handful of external
-- collaborators (weareaurora.pt) who need full board access despite not
-- having a company email. Kept in sync with EXTRA_ALLOWED_EMAILS in
-- app/login/page.tsx, which is what actually lets them past the magic-link
-- login's company-domain check in the first place.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  name_part text := split_part(new.email, '@', 1);
  first_part text := split_part(name_part, '.', 1);
  last_part text := split_part(name_part, '.', 2);
  computed_full_name text;
  computed_initials text;
begin
  if not exists (select 1 from public.profiles where email = new.email) then
    if last_part = '' then
      computed_full_name := initcap(first_part);
      computed_initials := upper(left(first_part, 2));
    else
      computed_full_name := initcap(first_part) || ' ' || initcap(last_part);
      computed_initials := upper(left(first_part, 1)) || upper(left(last_part, 1));
    end if;

    insert into public.profiles (id, full_name, email, initials, is_marketing)
    values (
      gen_random_uuid(),
      computed_full_name,
      new.email,
      computed_initials,
      new.email in (
        'ivo.bernardo@daredata.engineering',
        'guilherme@weareaurora.pt',
        'margarida@weareaurora.pt',
        'carolina@weareaurora.pt',
        'francisco@weareaurora.pt',
        'ana@weareaurora.pt',
        'ruben@weareaurora.pt'
      ) -- pre-approved marketing allow-list
    );
  end if;
  return new;
end;
$$;
