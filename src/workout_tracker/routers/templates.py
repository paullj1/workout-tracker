from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_data_key, get_db, get_encryption_service
from ..encryption import EncryptionService
from ..models import User, WorkoutTemplate
from ..schemas import TemplateCreate, TemplatePayload, TemplateRead

router = APIRouter(prefix="/templates", tags=["templates"])


def _deserialize(record: WorkoutTemplate, data_key: bytes, encryption_service: EncryptionService) -> TemplatePayload:
    payload = encryption_service.decrypt_payload(data_key, record.encrypted_payload)
    return TemplatePayload(**payload)


def _serialize(record: WorkoutTemplate, payload: TemplatePayload) -> TemplateRead:
    return TemplateRead(
        id=record.id,
        created_at=record.created_at,
        updated_at=record.updated_at,
        **payload.model_dump(),
    )


def _get_template_or_404(db: Session, user: User, template_id: str) -> WorkoutTemplate:
    template = db.get(WorkoutTemplate, template_id)
    if not template or template.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.get("", response_model=list[TemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> list[TemplateRead]:
    stmt = select(WorkoutTemplate).where(WorkoutTemplate.user_id == user.id).order_by(WorkoutTemplate.created_at.desc())
    templates = db.scalars(stmt).all()
    return [_serialize(record, _deserialize(record, data_key, encryption_service)) for record in templates]


@router.post("", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    data_key: bytes = Depends(get_data_key),
    encryption_service: EncryptionService = Depends(get_encryption_service),
) -> TemplateRead:
    blob = encryption_service.encrypt_payload(data_key, payload.model_dump())
    record = WorkoutTemplate(user=user, encrypted_payload=blob)
    db.add(record)
    db.flush()
    return _serialize(record, payload)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    record = _get_template_or_404(db, user, template_id)
    db.delete(record)
