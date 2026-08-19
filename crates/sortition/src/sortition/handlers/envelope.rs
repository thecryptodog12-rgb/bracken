// SPDX-License-Identifier: LGPL-4.0-only

//! Actix lifecycle and event-envelope routing.

use super::*;

impl Actor for Sortition {
    type Context = actix::Context<Self>;
    fn started(&mut self, ctx: &mut Self::Context) {
        ctx.set_mailbox_capacity(MAILBOX_LIMIT);
    }
}

impl Handler<LoxleyEvent> for Sortition {
    type Result = ();

    fn handle(&mut self, msg: LoxleyEvent, ctx: &mut Self::Context) -> Self::Result {
        let (msg, ec) = msg.into_components();
        match msg {
            LoxleyEventData::E3Requested(data) => self.notify_sync(ctx, TypedEvent::new(data, ec)),
            LoxleyEventData::CiphernodeAdded(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CiphernodeRemoved(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::TicketBalanceUpdated(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::OperatorActivationChanged(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::ConfigurationUpdated(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CommitteeRequested(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CommitteePublished(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::PlaintextOutputPublished(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CommitteeFinalized(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CommitteeMemberExpelled(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::CommitteeMemberExcluded(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::E3Failed(data) => self.notify_sync(ctx, TypedEvent::new(data, ec)),
            LoxleyEventData::E3StageChanged(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            LoxleyEventData::E3RequestComplete(data) => {
                self.notify_sync(ctx, TypedEvent::new(data, ec))
            }
            _ => (),
        }
    }
}
