-- RPC to atomically update an account balance
create or replace function public.update_account_balance(
  p_account_id uuid,
  p_amount numeric
)
returns void as $$
begin
  update public.accounts
  set balance = balance + p_amount
  where id = p_account_id;
end;
$$ language plpgsql security definer;

-- Trigger: auto-update account balances when transactions are inserted
create or replace function public.on_transaction_insert()
returns trigger as $$
begin
  if new.type = 'income' then
    update public.accounts set balance = balance + new.amount where id = new.account_id;
  elsif new.type = 'expense' then
    update public.accounts set balance = balance - new.amount where id = new.account_id;
  elsif new.type = 'transfer' then
    update public.accounts set balance = balance - new.amount where id = new.account_id;
    if new.transfer_to_account_id is not null then
      update public.accounts set balance = balance + new.amount where id = new.transfer_to_account_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger: reverse balance when transactions are deleted
create or replace function public.on_transaction_delete()
returns trigger as $$
begin
  if old.type = 'income' then
    update public.accounts set balance = balance - old.amount where id = old.account_id;
  elsif old.type = 'expense' then
    update public.accounts set balance = balance + old.amount where id = old.account_id;
  elsif old.type = 'transfer' then
    update public.accounts set balance = balance + old.amount where id = old.account_id;
    if old.transfer_to_account_id is not null then
      update public.accounts set balance = balance - old.amount where id = old.transfer_to_account_id;
    end if;
  end if;
  return old;
end;
$$ language plpgsql security definer;

-- Trigger: handle balance adjustment on transaction update
create or replace function public.on_transaction_update()
returns trigger as $$
begin
  -- Reverse old
  if old.type = 'income' then
    update public.accounts set balance = balance - old.amount where id = old.account_id;
  elsif old.type = 'expense' then
    update public.accounts set balance = balance + old.amount where id = old.account_id;
  elsif old.type = 'transfer' then
    update public.accounts set balance = balance + old.amount where id = old.account_id;
    if old.transfer_to_account_id is not null then
      update public.accounts set balance = balance - old.amount where id = old.transfer_to_account_id;
    end if;
  end if;

  -- Apply new
  if new.type = 'income' then
    update public.accounts set balance = balance + new.amount where id = new.account_id;
  elsif new.type = 'expense' then
    update public.accounts set balance = balance - new.amount where id = new.account_id;
  elsif new.type = 'transfer' then
    update public.accounts set balance = balance - new.amount where id = new.account_id;
    if new.transfer_to_account_id is not null then
      update public.accounts set balance = balance + new.amount where id = new.transfer_to_account_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_transaction_insert after insert on public.transactions
  for each row execute procedure public.on_transaction_insert();

create trigger trg_transaction_delete after delete on public.transactions
  for each row execute procedure public.on_transaction_delete();

create trigger trg_transaction_update after update on public.transactions
  for each row execute procedure public.on_transaction_update();
